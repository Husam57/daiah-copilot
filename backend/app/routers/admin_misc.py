"""لوحة التحكم (JWT): المراكز المعتمدة (CRUD) + إحصاءات الرئيسية."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_supabase
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
    }
