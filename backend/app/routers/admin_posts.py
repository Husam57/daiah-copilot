"""إدارة المنشورات (لوحة التحكم — JWT مطلوب)."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..config import redact
from ..db import get_supabase
from ..models import ContentType, PostStatus
from ..rag.indexer import index_post, unindex_post
from ..schemas import (
    MessageResponse, Post, PostIn, PostListItem, PostPage, PostUpdate, PostWithIndex, User,
)
from ..security import require_admin_user
from ..utils import clean_search, reject_nulls, resolve_slug

router = APIRouter(
    prefix="/api/admin/posts",
    tags=["admin: posts"],
    dependencies=[Depends(require_admin_user)],
)

_LIST_COLUMNS = ",".join(PostListItem.model_fields)
_REQUIRED = ("section_id", "slug", "title_ar", "content_ar", "tags", "content_type", "status")
# تغيّر أي منها في منشور منشور = إعادة فهرسة (المقاطع مبنية على العنوان والمحتوى)
_INDEXED_FIELDS = ("title_ar", "title_en", "content_ar", "content_en")
log = logging.getLogger("daiah")


def _try_index(post_id: int) -> tuple[dict | None, str | None]:
    """فهرسة لا تُفشل الطلب: ترجع (النتيجة، رسالة تحذير)."""
    try:
        return index_post(post_id), None
    except Exception as e:  # noqa: BLE001
        log.warning("indexing post %s failed: %s", post_id, redact(str(e)))
        return None, f"تم الحفظ لكن فشلت الفهرسة: {redact(str(e))[:200]} — أعد المحاولة من «إعادة فهرسة»"


def _with_index(post_id: int, result: dict | None, warning: str | None) -> PostWithIndex:
    row = _get_or_404(post_id)
    return PostWithIndex(
        **row, indexed=result is not None, chunks=(result or {}).get("chunks"), index_warning=warning,
    )


def _get_or_404(post_id: int) -> dict:
    rows = get_supabase().table("posts").select("*").eq("id", post_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المنشور غير موجود")
    return rows[0]


def _check_section(section_id: int) -> None:
    rows = get_supabase().table("sections").select("id").eq("id", section_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "القسم المحدد غير موجود")


@router.get("", response_model=PostPage, summary="قائمة المنشورات (فلترة + بحث + صفحات)")
def list_posts(
    section_id: int | None = None,
    status_: PostStatus | None = Query(None, alias="status"),
    content_type: ContentType | None = None,
    q: str | None = Query(None, description="بحث في العنوان والملخص"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PostPage:
    query = get_supabase().table("posts").select(_LIST_COLUMNS, count="exact")
    if section_id is not None:
        query = query.eq("section_id", section_id)
    if status_:
        query = query.eq("status", status_)
    if content_type:
        query = query.eq("content_type", content_type)
    term = clean_search(q)
    if term:
        query = query.or_(
            f"title_ar.ilike.*{term}*,title_en.ilike.*{term}*,summary_ar.ilike.*{term}*"
        )
    start = (page - 1) * page_size
    res = (
        query.order("updated_at", desc=True).order("id", desc=True)
        .range(start, start + page_size - 1).execute()
    )
    return PostPage(
        items=[PostListItem(**r) for r in res.data],
        total=res.count or 0, page=page, page_size=page_size,
    )


@router.get("/{post_id}", response_model=Post, summary="منشور واحد كاملاً")
def get_post(post_id: int) -> Post:
    return Post(**_get_or_404(post_id))


@router.post("", response_model=Post, status_code=201, summary="إنشاء منشور (مسودة أو مراجعة)")
def create_post(body: PostIn, user: User = Depends(require_admin_user)) -> Post:
    _check_section(body.section_id)
    data = body.model_dump()
    data["slug"] = resolve_slug("posts", body.slug, body.title_en, prefix="post")
    data["created_by"] = user.id
    row = get_supabase().table("posts").insert(data).execute().data[0]
    return Post(**row)


@router.put(
    "/{post_id}", response_model=PostWithIndex,
    summary="تعديل منشور (الحقول المرسلة فقط) — يعيد الفهرسة أو يلغيها تلقائياً",
)
def update_post(post_id: int, body: PostUpdate) -> PostWithIndex:
    current = _get_or_404(post_id)
    data = body.model_dump(exclude_unset=True)
    reject_nulls(data, _REQUIRED)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لم تُرسل أي حقول للتعديل")
    if "section_id" in data:
        _check_section(data["section_id"])
    if "slug" in data:
        data["slug"] = resolve_slug("posts", data["slug"], None, "post", exclude_id=post_id)
    was_published = current["status"] == "published"
    unpublish = was_published and data.get("status") in ("draft", "review")
    if unpublish:
        # إلغاء النشر: يختفي من الموقع العام ومن بحث المساعد
        data["published_at"] = None
    get_supabase().table("posts").update(data).eq("id", post_id).execute()

    result = warning = None
    if unpublish:
        try:
            unindex_post(post_id)
        except Exception as e:  # noqa: BLE001 — البحث يستبعد غير المنشور على أي حال
            warning = f"أُلغي النشر لكن تعذّر حذف المقاطع: {redact(str(e))[:200]}"
    elif was_published and any(
        f in data and data[f] != current.get(f) for f in _INDEXED_FIELDS
    ):
        result, warning = _try_index(post_id)
    return _with_index(post_id, result, warning)


@router.delete("/{post_id}", response_model=MessageResponse, summary="حذف منشور")
def delete_post(post_id: int) -> MessageResponse:
    post = _get_or_404(post_id)
    # post_chunks تُحذف تلقائياً (ON DELETE CASCADE)
    get_supabase().table("posts").delete().eq("id", post_id).execute()
    return MessageResponse(detail=f"تم حذف المنشور «{post['title_ar']}»")


@router.post(
    "/{post_id}/publish", response_model=PostWithIndex,
    summary="نشر منشور + فهرسته (فشل الفهرسة لا يلغي النشر)",
)
def publish_post(post_id: int, user: User = Depends(require_admin_user)) -> PostWithIndex:
    _get_or_404(post_id)
    data = {
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": user.id,
    }
    get_supabase().table("posts").update(data).eq("id", post_id).execute()
    result, warning = _try_index(post_id)
    return _with_index(post_id, result, warning)


@router.post(
    "/{post_id}/reindex", response_model=PostWithIndex, summary="إعادة فهرسة منشور منشور",
)
def reindex_post(post_id: int) -> PostWithIndex:
    post = _get_or_404(post_id)
    if post["status"] != "published":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لا يُفهرس إلا المنشور المنشور")
    try:
        result = index_post(post_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"فشلت الفهرسة: {redact(str(e))[:200]}")
    return _with_index(post_id, result, None)
