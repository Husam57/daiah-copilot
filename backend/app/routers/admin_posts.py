"""إدارة المنشورات (لوحة التحكم — JWT مطلوب)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..db import get_supabase
from ..models import ContentType, PostStatus
from ..schemas import MessageResponse, Post, PostIn, PostListItem, PostPage, PostUpdate, User
from ..security import require_admin_user
from ..utils import clean_search, reject_nulls, resolve_slug

router = APIRouter(
    prefix="/api/admin/posts",
    tags=["admin: posts"],
    dependencies=[Depends(require_admin_user)],
)

_LIST_COLUMNS = ",".join(PostListItem.model_fields)
_REQUIRED = ("section_id", "slug", "title_ar", "content_ar", "tags", "content_type", "status")


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


@router.put("/{post_id}", response_model=Post, summary="تعديل منشور (الحقول المرسلة فقط)")
def update_post(post_id: int, body: PostUpdate) -> Post:
    current = _get_or_404(post_id)
    data = body.model_dump(exclude_unset=True)
    reject_nulls(data, _REQUIRED)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لم تُرسل أي حقول للتعديل")
    if "section_id" in data:
        _check_section(data["section_id"])
    if "slug" in data:
        data["slug"] = resolve_slug("posts", data["slug"], None, "post", exclude_id=post_id)
    if current["status"] == "published" and data.get("status") in ("draft", "review"):
        # إلغاء النشر: يختفي من الموقع العام
        data["published_at"] = None
        # TODO الخطوة 4: حذف مقاطع المنشور من post_chunks عند إلغاء النشر
    # TODO الخطوة 4: إعادة فهرسة المنشور المنشور إذا تغيّر content_ar/content_en
    row = get_supabase().table("posts").update(data).eq("id", post_id).execute().data[0]
    return Post(**row)


@router.delete("/{post_id}", response_model=MessageResponse, summary="حذف منشور")
def delete_post(post_id: int) -> MessageResponse:
    post = _get_or_404(post_id)
    # post_chunks تُحذف تلقائياً (ON DELETE CASCADE)
    get_supabase().table("posts").delete().eq("id", post_id).execute()
    return MessageResponse(detail=f"تم حذف المنشور «{post['title_ar']}»")


@router.post("/{post_id}/publish", response_model=Post, summary="نشر منشور")
def publish_post(post_id: int, user: User = Depends(require_admin_user)) -> Post:
    _get_or_404(post_id)
    data = {
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": user.id,
    }
    row = get_supabase().table("posts").update(data).eq("id", post_id).execute().data[0]

    # TODO الخطوة 4: فهرسة RAG هنا
    # (تقسيم content_ar/content_en إلى مقاطع -> embeddings من Gemini -> post_chunks)

    return Post(**row)
