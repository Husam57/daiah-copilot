"""إدارة الأقسام (لوحة التحكم — JWT مطلوب)."""
from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_supabase
from ..schemas import MessageResponse, Section, SectionAdmin, SectionIn, SectionUpdate
from ..security import require_admin_user
from ..utils import reject_nulls, resolve_slug

router = APIRouter(
    prefix="/api/admin/sections",
    tags=["admin: sections"],
    dependencies=[Depends(require_admin_user)],
)

_REQUIRED = ("name_ar", "slug", "category", "sort_order", "is_active")


def _get_or_404(section_id: int) -> dict:
    rows = get_supabase().table("sections").select("*").eq("id", section_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "القسم غير موجود")
    return rows[0]


def _check_parent(parent_id: int | None, self_id: int | None = None) -> None:
    if parent_id is None:
        return
    if parent_id == self_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لا يمكن أن يكون القسم أباً لنفسه")
    rows = get_supabase().table("sections").select("id").eq("id", parent_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "القسم الأب غير موجود")


def _posts_count(section_id: int) -> int:
    return (
        get_supabase().table("posts").select("id", count="exact")
        .eq("section_id", section_id).limit(1).execute().count or 0
    )


@router.get("", response_model=list[SectionAdmin], summary="كل الأقسام مع عدد المنشورات")
def list_sections() -> list[SectionAdmin]:
    # posts(count): القاعدة تحسب عدد المنشورات لكل قسم في نفس الاستعلام
    rows = (
        get_supabase().table("sections").select("*, posts(count)")
        .order("sort_order").order("id").execute().data
    )
    return [
        SectionAdmin(**s, posts_count=(s.pop("posts") or [{"count": 0}])[0]["count"])
        for s in rows
    ]


@router.post("", response_model=Section, status_code=201, summary="إنشاء قسم")
def create_section(body: SectionIn) -> Section:
    _check_parent(body.parent_id)
    data = body.model_dump()
    data["slug"] = resolve_slug("sections", body.slug, body.name_en, prefix="section")
    row = get_supabase().table("sections").insert(data).execute().data[0]
    return Section(**row)


@router.put("/{section_id}", response_model=Section, summary="تعديل قسم (الحقول المرسلة فقط)")
def update_section(section_id: int, body: SectionUpdate) -> Section:
    _get_or_404(section_id)
    data = body.model_dump(exclude_unset=True)
    reject_nulls(data, _REQUIRED)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لم تُرسل أي حقول للتعديل")
    if "parent_id" in data:
        _check_parent(data["parent_id"], self_id=section_id)
    if "slug" in data:
        data["slug"] = resolve_slug("sections", data["slug"], None, "section", exclude_id=section_id)
    row = get_supabase().table("sections").update(data).eq("id", section_id).execute().data[0]
    return Section(**row)


@router.delete("/{section_id}", response_model=MessageResponse, summary="حذف قسم فارغ")
def delete_section(section_id: int) -> MessageResponse:
    section = _get_or_404(section_id)
    n = _posts_count(section_id)
    if n:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"لا يمكن حذف القسم «{section['name_ar']}» لأنه يحتوي على {n} منشور. "
            "انقل المنشورات إلى قسم آخر أو احذفها أولاً.",
        )
    get_supabase().table("sections").delete().eq("id", section_id).execute()
    return MessageResponse(detail=f"تم حذف القسم «{section['name_ar']}»")
