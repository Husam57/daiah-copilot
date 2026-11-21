"""لوحة التحكم (JWT): المراكز المعتمدة (CRUD) + إحصاءات الرئيسية + النشاط + حالة النظام."""
import threading
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..ai_config import get_active_settings
from ..config import CHAT_MODELS, EMBEDDING_MODEL, redact
from ..db import get_supabase
from ..rag.embeddings import get_genai_client
from .admin_ai import unanswered
from ..models import ReferralCenter, ReferralCenterCreate, _Model
from ..schemas import MessageResponse
from ..security import require_admin_user
from ..utils import fetch_all, reject_nulls

_auth = [Depends(require_admin_user)]
centers = APIRouter(prefix="/api/admin/referral-centers", tags=["admin: referral centers"], dependencies=_auth)
dashboard = APIRouter(prefix="/api/admin/dashboard", tags=["admin: dashboard"], dependencies=_auth)


class ReferralCenterUpdate(_Model):
    name: str | None = None
    country: str | None = None
    url: str | None = None
    contact: str | None = None


def _center_or_404(center_id: int) -> dict:
    rows = get_supabase().table("referral_centers").select("*").eq("id", center_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المركز غير موجود")
    return rows[0]


@centers.get("", response_model=list[ReferralCenter], summary="قائمة المراكز المعتمدة")
def list_centers() -> list[ReferralCenter]:
    rows = get_supabase().table("referral_centers").select("*").order("id").execute().data
    return [ReferralCenter(**r) for r in rows]


@centers.get("/{center_id}", response_model=ReferralCenter, summary="مركز واحد")
def get_center(center_id: int) -> ReferralCenter:
    return ReferralCenter(**_center_or_404(center_id))


@centers.post("", response_model=ReferralCenter, status_code=201, summary="إضافة مركز")
def create_center(body: ReferralCenterCreate) -> ReferralCenter:
    row = get_supabase().table("referral_centers").insert(body.model_dump()).execute().data[0]
    return ReferralCenter(**row)


@centers.put("/{center_id}", response_model=ReferralCenter, summary="تعديل مركز (الحقول المرسلة فقط)")
def update_center(center_id: int, body: ReferralCenterUpdate) -> ReferralCenter:
    _center_or_404(center_id)
    data = body.model_dump(exclude_unset=True)
    reject_nulls(data, ("name",))
    if "name" in data and not data["name"]:
        raise HTTPException(422, "اسم المركز لا يمكن أن يكون فارغاً")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لم تُرسل أي حقول للتعديل")
    row = get_supabase().table("referral_centers").update(data).eq("id", center_id).execute().data[0]
    return ReferralCenter(**row)


@centers.delete("/{center_id}", response_model=MessageResponse, summary="حذف مركز")
def delete_center(center_id: int) -> MessageResponse:
    c = _center_or_404(center_id)
    get_supabase().table("referral_centers").delete().eq("id", center_id).execute()
    return MessageResponse(detail=f"تم حذف المركز «{c['name']}»")


def _count(table: str, **eq) -> int:
    q = get_supabase().table(table).select("id", count="exact")
    for k, v in eq.items():
        q = q.eq(k, v)
    return q.limit(1).execute().count or 0


@dashboard.get("/stats", summary="إحصاءات الرئيسية")
def stats() -> dict:
    sb = get_supabase()
    posts = fetch_all(lambda: sb.table("posts").select("status, indexed_at").order("id"))
    by_status = {"draft": 0, "review": 0, "published": 0}
    for p in posts:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
    indexed = sum(1 for p in posts if p["status"] == "published" and p["indexed_at"])

    # "اليوم" بتوقيت UTC
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_logs = fetch_all(lambda: sb.table("chat_logs").select("is_fallback").gte("created_at", today).order("id"))
    total_logs = _count("chat_logs")
    total_fallback = _count("chat_logs", is_fallback=True)
    today_fallback = sum(1 for r in today_logs if r["is_fallback"])

    def rate(part: int, whole: int) -> float:
        return round(part / whole, 4) if whole else 0.0

    return {
        "sections": _count("sections"),
        "sections_active": _count("sections", is_active=True),
        "posts_total": len(posts),
        "posts_by_status": by_status,
        "posts_indexed": indexed,
        "chunks": _count("post_chunks"),
        "questions_today": len(today_logs),
        "fallback_today": today_fallback,
        "fallback_rate_today": rate(today_fallback, len(today_logs)),
        "questions_total": total_logs,
        "fallback_rate_total": rate(total_fallback, total_logs),
        "referral_centers": _count("referral_centers"),
        "unanswered_questions": len(unanswered(limit=200, period="all")),  # أسئلة fallback مميزة غير متجاهلة
    }


# ============ آخر النشاطات ============
def _ts(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


@dashboard.get("/activity", summary="آخر النشاطات (مشتقة من المنشورات وسجل الإعدادات)")
def activity(limit: int = Query(12, ge=1, le=50)) -> list[dict]:
    """لا يوجد جدول نشاط: الأحداث تُشتق من published_at / indexed_at / updated_at
    للمنشورات، ومن ai_settings_history (كل صف = انتقال إلى إصدار جديد)."""
    sb = get_supabase()
    posts = (
        sb.table("posts").select("id, title_ar, status, published_at, updated_at, indexed_at")
        .order("updated_at", desc=True).limit(40).execute().data
    )
    events: list[dict] = []
    for p in posts:
        ref = {"post_id": p["id"], "title": p["title_ar"]}
        pub, idx, upd = _ts(p["published_at"]), _ts(p["indexed_at"]), _ts(p["updated_at"])
        if pub:
            events.append({"type": "post_published", "at": p["published_at"], **ref})
        if idx:
            events.append({"type": "index_updated", "at": p["indexed_at"], **ref})
        # التعديل يُعرض فقط إن لم يكن هو نفسه لحظة النشر/الفهرسة
        if upd and all(not t or abs((upd - t).total_seconds()) > 5 for t in (pub, idx)):
            kind = "post_review" if p["status"] == "review" else "post_saved"
            events.append({"type": kind, "at": p["updated_at"], **ref})
    hist = (
        sb.table("ai_settings_history").select("version, saved_at")
        .order("saved_at", desc=True).limit(20).execute().data
    )
    for h in hist:
        events.append({"type": "settings_updated", "at": h["saved_at"], "version": h["version"] + 1})
    events.sort(key=lambda e: _ts(e["at"]) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return events[:limit]


# ============ حالة النظام ============
_STATUS_TTL = 60.0  # ثوانٍ: فحص Gemini لا يتكرر مع كل تحميل للصفحة
_status_cache: dict = {"at": 0.0, "data": None}
_status_lock = threading.Lock()
STALE_TOLERANCE = timedelta(seconds=30)


def _check(fn) -> tuple[bool, str, int]:
    t0 = time.perf_counter()
    try:
        detail = fn()
        return True, detail, int((time.perf_counter() - t0) * 1000)
    except Exception as e:  # noqa: BLE001
        return False, redact(str(e))[:160], int((time.perf_counter() - t0) * 1000)


def _db_check() -> str:
    get_supabase().table("users").select("id").limit(1).execute()
    return "متصلة"


def _gemini_check() -> str:
    # طلب بيانات النموذج فقط (لا يستهلك حصة توليد أو embeddings)
    get_genai_client().models.get(model=EMBEDDING_MODEL)
    return "المفتاح يعمل"


def _index_check() -> tuple[str, str]:
    rows = get_supabase().table("posts").select("updated_at, indexed_at").eq("status", "published").execute().data
    if not rows:
        return "warning", "لا توجد منشورات منشورة بعد"
    pending = sum(1 for r in rows if not r["indexed_at"])
    stale = sum(
        1 for r in rows if r["indexed_at"]
        and _ts(r["updated_at"]) - _ts(r["indexed_at"]) > STALE_TOLERANCE
    )
    if pending or stale:
        return "warning", f"{pending} بانتظار الفهرسة · {stale} يحتاج تحديث"
    return "ok", f"{len(rows)} منشور مفهرس"


def _compute_status() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    db_ok, db_detail, db_ms = _check(_db_check)
    ai_ok, ai_detail, ai_ms = _check(_gemini_check)
    if db_ok:
        try:
            idx_state, idx_detail = _index_check()
        except Exception as e:  # noqa: BLE001
            idx_state, idx_detail = "down", redact(str(e))[:160]
        settings_ok, settings_detail, _ = _check(lambda: f"الإعدادات الإصدار {get_active_settings().version}")
    else:
        idx_state, idx_detail = "down", "قاعدة البيانات غير متاحة"
        settings_ok, settings_detail = False, "قاعدة البيانات غير متاحة"
    if db_ok and ai_ok and settings_ok:
        agent_state, agent_detail = "ok", settings_detail
    elif not settings_ok:
        agent_state, agent_detail = "down", settings_detail
    else:
        agent_state, agent_detail = "down", "يتطلب قاعدة البيانات و Gemini"
    items = [
        {"key": "database", "label": "قاعدة البيانات", "state": "ok" if db_ok else "down",
         "detail": db_detail, "latency_ms": db_ms},
        {"key": "gemini", "label": "Gemini API", "state": "ok" if ai_ok else "down",
         "detail": ai_detail, "latency_ms": ai_ms},
        {"key": "index", "label": "فهرس المتجهات", "state": idx_state, "detail": idx_detail},
        {"key": "agent", "label": "المساعد", "state": agent_state, "detail": agent_detail},
    ]
    overall = "down" if any(i["state"] == "down" for i in items) else (
        "warning" if any(i["state"] == "warning" for i in items) else "ok")
    return {"overall": overall, "checked_at": now, "items": items,
            "chat_models": list(CHAT_MODELS), "embedding_model": EMBEDDING_MODEL}


@dashboard.get("/system-status", summary="حالة النظام (مخزنة 60 ث؛ refresh=true لفحص فوري)")
def system_status(refresh: bool = False) -> dict:
    with _status_lock:
        cached = _status_cache["data"]
        if cached and not refresh and time.monotonic() - _status_cache["at"] < _STATUS_TTL:
            return cached
    data = _compute_status()
    with _status_lock:
        _status_cache.update(at=time.monotonic(), data=data)
    return data


# ============ الأسئلة يومياً (رسم الرئيسية) ============
@dashboard.get("/questions-daily", summary="عدد الأسئلة وغير المجابة لكل يوم (آخر N أيام، بالأيام الفارغة)")
def questions_daily(
    days: int = Query(7, ge=1, le=90),
    tz_offset: int = Query(0, ge=-720, le=840, description="فرق التوقيت المحلي عن UTC بالدقائق (الرياض = 180)"),
) -> dict:
    """لكل يوم: questions (كل الأسئلة)، fallback (غير المجابة)، answered، fallback_rate.
    الأيام بالتوقيت المحلي للمتصفح. المتجاهَل يُحسب في الإجمالي (هو سؤال طُرح فعلاً)."""
    tz = timezone(timedelta(minutes=tz_offset))
    today = datetime.now(tz).date()
    start_day = today - timedelta(days=days - 1)
    start = datetime(start_day.year, start_day.month, start_day.day, tzinfo=tz)
    sb = get_supabase()
    rows = fetch_all(
        lambda: sb.table("chat_logs").select("created_at, is_fallback").gte("created_at", start.isoformat()).order("id")
    )
    buckets = {start_day + timedelta(days=i): [0, 0] for i in range(days)}
    for r in rows:
        d = _ts(r["created_at"]).astimezone(tz).date()
        if d in buckets:
            buckets[d][0] += 1
            buckets[d][1] += 1 if r["is_fallback"] else 0
    items = [
        {"date": d.isoformat(), "questions": q, "fallback": f, "answered": q - f,
         "fallback_rate": round(f / q, 4) if q else None}
        for d, (q, f) in buckets.items()
    ]
    total = sum(i["questions"] for i in items)
    fb = sum(i["fallback"] for i in items)
    return {"days": days, "tz_offset": tz_offset, "items": items, "total": total, "fallback": fb,
            "fallback_rate": round(fb / total, 4) if total else None}
