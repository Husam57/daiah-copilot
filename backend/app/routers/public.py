"""المسارات العامة (بدون JWT): الأقسام النشطة + المواد المنشورة فقط.

الردود مخزنة 60 ث (cached_public) وتُبطل عند أي تعديل في اللوحة.
كل ما يُعرض هنا = حقول جدول posts كما هي (لا يمر على أي نموذج). الحقول المحسوبة فقط:
reading_minutes (من طول النص) و excerpt (أول سطور النص المنشور نفسه إن لم يوجد ملخص).
"""
import math
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from ..ai_config import get_active_settings
from ..cache import cached_public
from ..db import get_supabase
from ..models import Category, ContentType
from ..rag.chunking import clean_html
from ..schemas import (
    PublicCategoryCount,
    PublicPost,
    PublicPostCard,
    PublicPostPage,
    PublicReferralCenter,
    PublicSection,
    PublicSectionPosts,
    PublicTopic,
)
from ..utils import clean_search, fetch_all

router = APIRouter(prefix="/api", tags=["public"])

_SECTION_COLUMNS = ",".join(f for f in PublicSection.model_fields if f != "posts_count")
_POST_COLUMNS = ",".join(
    f for f in PublicPost.model_fields
    if f not in ("section", "reading_minutes", "reading_minutes_en", "reviewed_by_name")
)
# أعمدة البطاقة (+ المحتوى لحساب وقت القراءة والمقتطف، ولا يُرسل كاملاً)
_CARD_COLUMNS = (
    "id, slug, section_id, title_ar, title_en, summary_ar, tags, topic, content_type, file_url, "
    "source_name, published_at, content_ar, content_en"
)

WORDS_PER_MINUTE = 200  # متوسط سرعة القراءة
EXCERPT_CHARS = 180


# ============ أدوات ============
def reading_minutes(html: str | None) -> int:
    """وقت القراءة بالدقائق من عدد كلمات النص (دقيقة واحدة على الأقل)."""
    words = len(clean_html(html).split())
    return max(1, math.ceil(words / WORDS_PER_MINUTE)) if words else 0


def excerpt(html: str | None, limit: int = EXCERPT_CHARS) -> str:
    """أول جزء من النص المنشور نفسه (بلا تعديل) مقطوعاً عند حد كلمة."""
    text = " ".join(clean_html(html).split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def _active_sections() -> list[dict]:
    return (
        get_supabase().table("sections").select(_SECTION_COLUMNS)
        .eq("is_active", True).order("sort_order").order("id").execute().data
    )


def _descendants(sections: list[dict], root_ids: set[int]) -> set[int]:
    """معرّفات الأقسام المحددة وكل أقسامها الفرعية (النشطة)."""
    out = set(root_ids)
    changed = True
    while changed:
        changed = False
        for s in sections:
            if s["parent_id"] in out and s["id"] not in out:
                out.add(s["id"])
                changed = True
    return out


def _published_rows(section_ids: set[int], columns: str = "id, section_id, topic, content_type, content_en") -> list[dict]:
    if not section_ids:
        return []
    ids = sorted(section_ids)
    return fetch_all(
        lambda: get_supabase().table("posts").select(columns)
        .eq("status", "published").in_("section_id", ids).order("id")
    )


def _section_ref(s: dict | None) -> dict | None:
    if not s:
        return None
    return {k: s[k] for k in ("name_ar", "name_en", "slug", "category")}


def _card(row: dict, sections_by_id: dict[int, dict]) -> PublicPostCard:
    has_en = bool((row.get("content_en") or "").strip())
    return PublicPostCard(
        id=row["id"], slug=row["slug"], title_ar=row["title_ar"], title_en=row.get("title_en"),
        summary_ar=row.get("summary_ar"), tags=row.get("tags") or [], topic=row.get("topic"),
        content_type=row["content_type"], file_url=row.get("file_url"),
        source_name=row.get("source_name"), published_at=row.get("published_at"),
        has_en=has_en,
        excerpt=row.get("summary_ar") or excerpt(row.get("content_ar")),
        excerpt_en=excerpt(row.get("content_en")) if has_en else None,
        reading_minutes=reading_minutes(row.get("content_ar")),
        reading_minutes_en=reading_minutes(row.get("content_en")) if has_en else None,
        section=_section_ref(sections_by_id.get(row["section_id"])),
    )


def _scope_section_ids(
    sections: list[dict], section: str | None, category: str | None
) -> set[int]:
    ids = {s["id"] for s in sections}
    if section:
        root = next((s for s in sections if s["slug"] == section), None)
        if not root:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "القسم غير موجود")
        ids = _descendants(sections, {root["id"]})
    if category:
        ids &= {s["id"] for s in sections if s["category"] == category}
    return ids


# ============ الأقسام ============
@router.get("/sections", response_model=list[PublicSection], summary="الأقسام النشطة مع عدد المواد المنشورة")
@cached_public
def list_sections(category: Category | None = None) -> list[PublicSection]:
    sections = _active_sections()
    rows = _published_rows({s["id"] for s in sections}, "id, section_id")
    direct: dict[int, int] = {}
    for r in rows:
        direct[r["section_id"]] = direct.get(r["section_id"], 0) + 1
    out = []
    for s in sections:
        if category and s["category"] != category:
            continue
        # عدد المواد = القسم وكل أقسامه الفرعية
        total = sum(direct.get(i, 0) for i in _descendants(sections, {s["id"]}))
        out.append(PublicSection(**s, posts_count=total))
    return out


@router.get("/categories", response_model=list[PublicCategoryCount], summary="عدد المواد المنشورة لكل مسار")
@cached_public
def category_counts() -> list[PublicCategoryCount]:
    sections = _active_sections()
    cat_of = {s["id"]: s["category"] for s in sections}
    counts: dict[str, int] = {c: 0 for c in ("methodology", "shubuhat", "intro_islam", "new_muslim")}
    for r in _published_rows(set(cat_of), "id, section_id"):
        counts[cat_of[r["section_id"]]] += 1
    sec_counts: dict[str, int] = {c: 0 for c in counts}
    for s in sections:
        sec_counts[s["category"]] += 1
    return [PublicCategoryCount(category=c, posts_count=n, sections_count=sec_counts[c]) for c, n in counts.items()]


@router.get("/topics", response_model=list[PublicTopic], summary="مواضيع المواد المنشورة مع العدد")
@cached_public
def list_topics(category: Category | None = None, section: str | None = None) -> list[PublicTopic]:
    sections = _active_sections()
    ids = _scope_section_ids(sections, section, category)
    counts: dict[str, int] = {}
    for r in _published_rows(ids, "id, section_id, topic"):
        t = (r.get("topic") or "").strip()
        if t:
            counts[t] = counts.get(t, 0) + 1
    return [PublicTopic(topic=t, posts_count=n) for t, n in sorted(counts.items(), key=lambda x: (-x[1], x[0]))]


@router.get(
    "/sections/{slug}/posts", response_model=PublicSectionPosts, summary="المواد المنشورة في قسم (وأقسامه الفرعية)"
)
@cached_public
def section_posts(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PublicSectionPosts:
    sections = _active_sections()
    section = next((s for s in sections if s["slug"] == slug), None)
    if not section:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "القسم غير موجود")
    result = query_posts(section=slug, page=page, page_size=page_size)
    return PublicSectionPosts(
        section=PublicSection(**section, posts_count=result.total),
        items=result.items, total=result.total, page=page, page_size=page_size,
    )


# ============ المواد ============
@router.get("/posts", response_model=PublicPostPage, summary="المواد المنشورة: بحث + فلترة + ترقيم")
@cached_public
def list_posts(
    q: str | None = Query(None, description="بحث في العنوان والملخص والموضوع والنص والوسوم"),
    section: str | None = Query(None, description="slug القسم (يشمل الأقسام الفرعية)"),
    category: Category | None = None,
    topic: str | None = None,
    content_type: ContentType | None = None,
    lang: Literal["ar", "en"] | None = Query(None, description="en = المواد التي لها نسخة إنجليزية"),
    tag: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
) -> PublicPostPage:
    return query_posts(q=q, section=section, category=category, topic=topic, content_type=content_type,
                       lang=lang, tag=tag, page=page, page_size=page_size)


def query_posts(
    q: str | None = None,
    section: str | None = None,
    category: str | None = None,
    topic: str | None = None,
    content_type: str | None = None,
    lang: str | None = None,
    tag: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> PublicPostPage:
    sections = _active_sections()
    by_id = {s["id"]: s for s in sections}
    ids = _scope_section_ids(sections, section, category)
    if not ids:
        return PublicPostPage(items=[], total=0, page=page, page_size=page_size)

    query = (
        get_supabase().table("posts").select(_CARD_COLUMNS, count="exact")
        .eq("status", "published").in_("section_id", sorted(ids))
    )
    if topic:
        query = query.eq("topic", topic)
    if content_type:
        query = query.eq("content_type", content_type)
    if lang == "en":
        query = query.not_.is_("content_en", "null").neq("content_en", "")
    if tag:
        query = query.contains("tags", [tag])
    term = clean_search(q)
    if term:
        like = f"%{term}%"
        conds = [f"{c}.ilike.{like}" for c in ("title_ar", "title_en", "summary_ar", "topic", "content_ar", "content_en")]
        if " " not in term:  # وسم مطابق تماماً (كلمة واحدة)
            conds.append(f"tags.cs.{{{term}}}")
        query = query.or_(",".join(conds))
    start = (page - 1) * page_size
    res = (
        query.order("published_at", desc=True, nullsfirst=False).order("id", desc=True)
        .range(start, start + page_size - 1).execute()
    )
    return PublicPostPage(
        items=[_card(r, by_id) for r in res.data], total=res.count or 0, page=page, page_size=page_size
    )


@router.get("/posts/latest", response_model=list[PublicPostCard], summary="أحدث المواد المنشورة")
@cached_public
def latest_posts(limit: int = Query(6, ge=1, le=24), category: Category | None = None) -> list[PublicPostCard]:
    return query_posts(category=category, page=1, page_size=limit).items


def _load_published(slug: str) -> dict:
    rows = (
        get_supabase().table("posts")
        .select(f"{_POST_COLUMNS},reviewed_by,section:sections!inner(name_ar,name_en,slug,category,is_active)")
        .eq("slug", slug).eq("status", "published").eq("section.is_active", True)
        .limit(1).execute().data
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المادة غير موجودة أو غير منشورة")
    return rows[0]


@router.get("/posts/{slug}", response_model=PublicPost, summary="مادة منشورة كاملة")
@cached_public
def get_post(slug: str) -> PublicPost:
    row = _load_published(slug)
    reviewer = None
    if row.get("reviewed_by"):
        users = get_supabase().table("users").select("name").eq("id", row["reviewed_by"]).limit(1).execute().data
        reviewer = (users[0]["name"] or "").strip() or None if users else None
    return PublicPost(
        **row,
        reviewed_by_name=reviewer,
        reading_minutes=reading_minutes(row["content_ar"]),
        reading_minutes_en=reading_minutes(row.get("content_en")) if row.get("content_en") else None,
    )


@router.get("/posts/{slug}/related", response_model=list[PublicPostCard], summary="مواد ذات صلة بمادة")
@cached_public
def related_posts(slug: str, limit: int = Query(3, ge=1, le=12)) -> list[PublicPostCard]:
    """ترتيب بسيط وقابل للتفسير: وسوم مشتركة (×3) + نفس الموضوع (×2) + نفس القسم (×1) ثم الأحدث."""
    post = _load_published(slug)
    sections = _active_sections()
    by_id = {s["id"]: s for s in sections}
    category = post["section"]["category"]
    tags = set(post.get("tags") or [])
    rows = _published_rows(set(by_id), _CARD_COLUMNS)
    scored = []
    for r in rows:
        if r["id"] == post["id"]:
            continue
        sec = by_id.get(r["section_id"])
        score = 3 * len(tags & set(r.get("tags") or []))
        if post.get("topic") and r.get("topic") == post["topic"]:
            score += 2
        if r["section_id"] == post["section_id"]:
            score += 1
        if sec and sec["category"] == category:
            score += 0.5
        if score > 0:
            scored.append((score, r.get("published_at") or "", r))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [_card(r, by_id) for _, _, r in scored[:limit]]


# ============ المراكز المعتمدة ============
@router.get("/referral-centers", response_model=list[PublicReferralCenter], summary="المراكز المعتمدة للإحالة")
@cached_public
def referral_centers() -> list[PublicReferralCenter]:
    rows = get_supabase().table("referral_centers").select("id, name, country, url, contact").order("id").execute().data
    return [PublicReferralCenter(**r) for r in rows]


# ============ الأسئلة المقترحة ============
@router.get("/public/suggested-questions", summary="الأسئلة المقترحة للزائر (من إعدادات اللوحة؛ قد تكون فارغة)")
@cached_public
def suggested_questions() -> dict:
    return {"questions": get_active_settings().suggested_questions}
