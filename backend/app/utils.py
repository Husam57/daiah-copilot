"""أدوات مشتركة: توليد slug فريد + تنظيف نص البحث."""
import re
import secrets
import unicodedata

from fastapi import HTTPException, status

from .db import get_supabase

_MAX_SLUG = 80


def slugify(text: str | None) -> str:
    """'Who is the Prophet?' -> 'who-is-the-prophet' (حروف لاتينية فقط، وإلا نص فارغ)."""
    if not text:
        return ""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    if len(slug) > _MAX_SLUG:
        slug = slug[:_MAX_SLUG].rsplit("-", 1)[0] or slug[:_MAX_SLUG]
    return slug


def _random_slug(prefix: str) -> str:
    return f"{prefix}-{secrets.randbelow(900_000) + 100_000}"  # مثال: post-482913


def slug_exists(table: str, slug: str, exclude_id: int | None = None) -> bool:
    q = get_supabase().table(table).select("id").eq("slug", slug)
    if exclude_id is not None:
        q = q.neq("id", exclude_id)
    return bool(q.limit(1).execute().data)


def resolve_slug(
    table: str,
    given: str | None,
    source_text: str | None,
    prefix: str,
    exclude_id: int | None = None,
) -> str:
    """- slug مُرسل: يُستخدم كما هو، ويُرفض إن كان مكرراً.
    - غير مُرسل: يُولَّد من source_text (الإنجليزي) أو رقم عشوائي، ويُضاف لاحقة رقمية عند التكرار.
    """
    if given:
        if slug_exists(table, given, exclude_id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"الرابط المختصر (slug) «{given}» مستخدم مسبقاً، اختر رابطاً آخر",
            )
        return given

    base = slugify(source_text)
    if not base:
        for _ in range(10):
            candidate = _random_slug(prefix)
            if not slug_exists(table, candidate, exclude_id):
                return candidate
    else:
        if not slug_exists(table, base, exclude_id):
            return base
        for n in range(2, 50):
            candidate = f"{base}-{n}"
            if not slug_exists(table, candidate, exclude_id):
                return candidate
        return f"{base}-{secrets.randbelow(900_000) + 100_000}"
    raise HTTPException(500, "تعذّر توليد رابط مختصر فريد، حاول مرة أخرى")


def clean_search(q: str | None) -> str:
    """يحذف الرموز التي تكسر صيغة فلاتر PostgREST (or/ilike)."""
    if not q:
        return ""
    return re.sub(r"[,()*%\\\"':.]", " ", q).strip()[:100]


def reject_nulls(data: dict, required: tuple[str, ...]) -> None:
    """في التحديث: الحقول الإلزامية لا تُرسل null."""
    bad = [k for k in required if k in data and data[k] is None]
    if bad:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "هذه الحقول لا يمكن أن تكون فارغة: " + "، ".join(bad),
        )


def fetch_all(build_query, page_size: int = 1000) -> list[dict]:
    """يجلب كل الصفوف على دفعات (PostgREST يحدّ الاستجابة بـ 1000 صف افتراضياً).

    build_query: دالة بلا مُعاملات ترجع query جديداً (select + فلاتر + order) في كل استدعاء.
    """
    out: list[dict] = []
    start = 0
    while True:
        rows = build_query().range(start, start + page_size - 1).execute().data or []
        out.extend(rows)
        if len(rows) < page_size:
            return out
        start += page_size
