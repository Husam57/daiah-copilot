"""المسارات العامة (بدون JWT): الأقسام النشطة + المواد المنشورة فقط."""
from fastapi import APIRouter, HTTPException, Query, status

from ..db import get_supabase
from ..schemas import PublicPost, PublicPostItem, PublicSection, PublicSectionPosts

router = APIRouter(prefix="/api", tags=["public"])

_SECTION_COLUMNS = ",".join(PublicSection.model_fields)
_ITEM_COLUMNS = ",".join(PublicPostItem.model_fields)
_POST_COLUMNS = ",".join(f for f in PublicPost.model_fields if f != "section")


@router.get("/sections", response_model=list[PublicSection], summary="الأقسام النشطة")
def list_sections() -> list[PublicSection]:
    rows = (
        get_supabase().table("sections").select(_SECTION_COLUMNS)
        .eq("is_active", True).order("sort_order").order("id").execute().data
    )
    return [PublicSection(**r) for r in rows]


@router.get(
    "/sections/{slug}/posts", response_model=PublicSectionPosts, summary="المواد المنشورة في قسم"
)
def section_posts(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PublicSectionPosts:
    sb = get_supabase()
    sections = (
        sb.table("sections").select(_SECTION_COLUMNS)
        .eq("slug", slug).eq("is_active", True).limit(1).execute().data
    )
    if not sections:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "القسم غير موجود")
    section = sections[0]
    start = (page - 1) * page_size
    res = (
        sb.table("posts").select(_ITEM_COLUMNS, count="exact")
        .eq("section_id", section["id"]).eq("status", "published")
        .order("published_at", desc=True).order("id", desc=True)
        .range(start, start + page_size - 1).execute()
    )
    return PublicSectionPosts(
        section=PublicSection(**section),
        items=[PublicPostItem(**r) for r in res.data],
        total=res.count or 0, page=page, page_size=page_size,
    )


@router.get("/posts/{slug}", response_model=PublicPost, summary="مادة منشورة كاملة")
def get_post(slug: str) -> PublicPost:
    rows = (
        get_supabase().table("posts")
        .select(f"{_POST_COLUMNS},section:sections!inner(name_ar,name_en,slug,category,is_active)")
        .eq("slug", slug).eq("status", "published").eq("section.is_active", True)
        .limit(1).execute().data
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المادة غير موجودة أو غير منشورة")
    return PublicPost(**rows[0])
