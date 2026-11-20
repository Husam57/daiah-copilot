"""إدارة الذكاء الاصطناعي (JWT): الفهرس، الإعدادات، المختبر، السجلات، الأسئلة غير المجابة."""
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from ..agent.pipeline import run_agent
from ..ai_config import get_active_settings
from ..config import CHAT_MODELS, EMBEDDING_DIM, EMBEDDING_MODEL
from ..db import get_supabase
from ..models import Lang, _Model
from ..rag.indexer import reindex_all
from ..schemas import User
from ..security import require_admin_user
from ..utils import fetch_all

router = APIRouter(
    prefix="/api/admin/ai",
    tags=["admin: ai"],
    dependencies=[Depends(require_admin_user)],
)

# إذا عُدّل المنشور بعد آخر فهرسة بأكثر من هذا -> "يحتاج إعادة فهرسة"
# (هامش لأن تحديث indexed_at قد يغيّر updated_at إن لم يُطبَّق trigger الجديد)
STALE_TOLERANCE = timedelta(seconds=30)


def _ts(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


# ============ الفهرس ============
@router.post("/reindex", summary="إعادة بناء الفهرس بالكامل (المنشورة فقط)")
def reindex() -> dict:
    return reindex_all()


@router.get("/index-status", summary="حالة فهرس RAG + حالة كل منشور منشور")
def index_status() -> dict:
    sb = get_supabase()
    posts = fetch_all(lambda: sb.table("posts").select(
        "id, slug, title_ar, status, updated_at, indexed_at").order("id"))
    chunk_rows = fetch_all(lambda: sb.table("post_chunks").select("post_id, lang").order("id"))
    counts: dict[int, dict[str, int]] = {}
    for c in chunk_rows:
        counts.setdefault(c["post_id"], {"ar": 0, "en": 0})[c["lang"]] += 1

    items, summary = [], {"indexed": 0, "stale": 0, "pending": 0}
    for p in posts:
        if p["status"] != "published":
            continue
        idx, upd = _ts(p["indexed_at"]), _ts(p["updated_at"])
        c = counts.get(p["id"], {"ar": 0, "en": 0})
        if not idx or not (c["ar"] or c["en"]):
            state = "pending"
        elif upd and upd - idx > STALE_TOLERANCE:
            state = "stale"
        else:
            state = "indexed"
        summary[state] += 1
        items.append({
            "post_id": p["id"], "slug": p["slug"], "title_ar": p["title_ar"], "state": state,
            "chunks_ar": c["ar"], "chunks_en": c["en"],
            "indexed_at": p["indexed_at"], "updated_at": p["updated_at"],
        })
    indexed_times = [p["indexed_at"] for p in posts if p["indexed_at"]]
    orphan = sum(1 for pid in counts if pid not in {i["post_id"] for i in items})
    return {
        "total_posts": len(posts),
        "published": len(items),
        **summary,
        "total_chunks": len(chunk_rows),
        "orphan_chunk_posts": orphan,  # مقاطع لمنشورات غير منشورة (يجب أن تكون 0)
        "last_indexed_at": max(indexed_times) if indexed_times else None,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dim": EMBEDDING_DIM,
        "items": items,
    }


# ============ الإعدادات ============
class AISettingsUpdate(_Model):
    guidance_prompt: str | None = Field(default=None, max_length=4000)
    similarity_threshold: float | None = Field(default=None, ge=0, le=1)
    top_k: int | None = Field(default=None, ge=1, le=10)
    fallback_message_ar: str | None = Field(default=None, min_length=1, max_length=2000)
    fallback_message_en: str | None = Field(default=None, min_length=1, max_length=2000)


def _settings_out(row: dict) -> dict:
    updater = None
    if row.get("updated_by"):
        u = get_supabase().table("users").select("id, name").eq("id", row["updated_by"]).limit(1).execute().data
        updater = u[0] if u else None
    return {**row, "updated_by_user": updater, "chat_models": list(CHAT_MODELS),
            "embedding_model": EMBEDDING_MODEL}


@router.get("/settings", summary="إعدادات الذكاء الاصطناعي الفعّالة")
def get_settings() -> dict:
    return _settings_out(get_active_settings().model_dump())


@router.put("/settings", summary="تعديل الإعدادات (كل حفظ يزيد version)")
def update_settings(body: AISettingsUpdate, user: User = Depends(require_admin_user)) -> dict:
    current = get_active_settings()
    data = body.model_dump(exclude_unset=True)
    data = {k: v for k, v in data.items() if v is not None}
    data["version"] = current.version + 1
    data["updated_by"] = user.id
    row = get_supabase().table("ai_settings").update(data).eq("id", current.id).execute().data[0]
    return _settings_out(row)


# ============ المختبر ============
class AITestRequest(_Model):
    message: str = Field(min_length=1, max_length=1000)
    lang: Lang = "ar"


@router.post("/test", summary="مختبر: نفس مسار المساعد بدون تسجيل، مع كل التفاصيل")
def ai_test(body: AITestRequest) -> dict:
    out = run_agent(body.message, body.lang, get_active_settings())
    return {**out["details"], "preview": out["response"]}


# ============ السجلات ============
@router.get("/logs", summary="سجل أسئلة المساعد (فلترة fallback + صفحات)")
def logs(
    fallback: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    q = get_supabase().table("chat_logs").select(
        "*, post:posts(id, slug, title_ar)", count="exact")
    if fallback is not None:
        q = q.eq("is_fallback", fallback)
    start = (page - 1) * page_size
    res = q.order("created_at", desc=True).order("id", desc=True).range(start, start + page_size - 1).execute()
    return {"items": res.data, "total": res.count or 0, "page": page, "page_size": page_size}


def _normalize_question(q: str) -> str:
    q = re.sub(r"[ً-ْـ]", "", q)          # تشكيل وتطويل
    q = re.sub(r"[؟?!.,،؛;:\"'«»()\[\]]", " ", q)
    return " ".join(q.lower().split())


@router.get("/unanswered", summary="أسئلة fallback مجمّعة حسب النص (التكرار + آخر تاريخ)")
def unanswered(limit: int = Query(50, ge=1, le=200)) -> list[dict]:
    sb = get_supabase()
    rows = sb.table("chat_logs").select(
        "question, detected_category, lang, matched_post_id, score, created_at, "
        "post:posts(id, slug, title_ar)"
    ).eq("is_fallback", True).order("created_at", desc=True).limit(2000).execute().data
    groups: dict[str, dict] = {}
    for r in rows:  # مرتبة من الأحدث: أول ظهور = آخر تاريخ
        key = _normalize_question(r["question"])
        g = groups.get(key)
        if g is None:
            groups[key] = {
                "question": r["question"], "count": 1, "last_at": r["created_at"],
                "category": r["detected_category"], "lang": r["lang"],
                "closest": ({**r["post"], "similarity": r["score"]} if r.get("post") else None),
            }
        else:
            g["count"] += 1
    return sorted(groups.values(), key=lambda g: (g["count"], g["last_at"]), reverse=True)[:limit]
