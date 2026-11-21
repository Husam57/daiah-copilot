"""استيراد المحتوى (JWT): POST /api/admin/posts/import — JSON أو CSV، مع معاينة (dry_run).

- لا نشر تلقائياً: الحالة بعد الاستيراد draft أو review فقط (والنشر والفهرسة من اللوحة كالمعتاد).
- النص يُحفظ كما هو حرفياً. الاستثناء الوحيد شكلي: نص عادي بلا وسوم HTML تُلفّ فقراته
  (المفصولة بسطر فارغ) في <p> مع تهريب الرموز، حتى يُعرض فقرات كما في المحرر. لا يتغير أي حرف.
- يُستورد الصالح فقط، وتُرجع أخطاء كل صف بالعربية.
"""
import csv
import html
import io
import json
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field

from ..db import get_supabase
from ..models import Category, _Model
from ..schemas import User
from ..security import require_admin_user
from ..utils import fetch_all, slugify

router = APIRouter(
    prefix="/api/admin/posts",
    tags=["admin: posts"],
    dependencies=[Depends(require_admin_user)],
)

MAX_ROWS = 500
MAX_BYTES = 5_000_000
CATEGORIES = ("methodology", "shubuhat", "intro_islam", "new_muslim")
CONTENT_TYPES = ("article", "booklet", "leaflet", "shubha_response")
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_HTML_TAG = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
_TAG_SPLIT = re.compile(r"[|،;,]")

# كل الأعمدة المعروفة (القالب يستخدمها بهذا الترتيب)
COLUMNS = (
    "id", "category", "section_slug", "topic", "title_ar", "title_en", "content_ar", "content_en",
    "summary_ar", "tags", "external_ref", "source_name", "content_type", "file_url",
)
REQUIRED = ("category", "title_ar", "content_ar")
FIELD_AR = {
    "id": "المعرّف (id)", "category": "المسار (category)", "section_slug": "القسم (section_slug)",
    "topic": "الموضوع", "title_ar": "العنوان بالعربية", "title_en": "العنوان بالإنجليزية",
    "content_ar": "النص بالعربية", "content_en": "النص بالإنجليزية", "summary_ar": "الملخص",
    "tags": "الوسوم", "external_ref": "الرابط الأصلي", "source_name": "المصدر",
    "content_type": "نوع المحتوى", "file_url": "رابط الملف",
}


class ImportRequest(_Model):
    format: str = Field(pattern=r"^(json|csv)$")
    content: str = Field(min_length=1, max_length=MAX_BYTES)
    status: str = Field(default="draft", pattern=r"^(draft|review)$")
    dry_run: bool = True


class ImportRow(_Model):
    index: int  # رقم الصف (يبدأ من 1)
    source_id: str | None = None
    slug: str | None = None
    title_ar: str | None = None
    title_en: str | None = None
    category: Category | None = None
    section_id: int | None = None
    section_name: str | None = None
    content_type: str | None = None
    topic: str | None = None
    tags: list[str] = []
    has_en: bool = False
    content_chars: int = 0
    errors: list[str] = []
    warnings: list[str] = []
    created_id: int | None = None


class ImportResult(_Model):
    dry_run: bool
    status: str
    total: int
    valid: int
    invalid: int
    created: int = 0
    rows: list[ImportRow]


# ============ القراءة ============
def _parse(fmt: str, content: str) -> list[dict]:
    text = content.lstrip("﻿")
    if fmt == "json":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"ملف JSON غير صالح (السطر {e.lineno}): تأكد من الفواصل وعلامات التنصيص"
            ) from None
        if isinstance(data, dict):
            data = data.get("posts", data.get("items"))
        if not isinstance(data, list):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "ملف JSON يجب أن يكون قائمة مواد [ … ] أو {\"posts\": [ … ]}")
        return data
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ملف CSV فارغ أو بلا صف عناوين")
    headers = [(h or "").strip().lower() for h in reader.fieldnames]
    missing = [c for c in REQUIRED if c not in headers]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "أعمدة ناقصة في ملف CSV: " + "، ".join(missing) + " — استخدم القالب الجاهز",
        )
    reader.fieldnames = headers
    return [dict(r) for r in reader]


def _str(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        v = str(v)
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v or None


def _tags(v) -> tuple[list[str], bool]:
    """(الوسوم، صالحة؟) — قائمة في JSON، أو نص مفصول بـ | ، ; , في CSV."""
    if v is None or v == "":
        return [], True
    if isinstance(v, list):
        items = [_str(t) for t in v]
        if any(t is None and x not in (None, "") for t, x in zip(items, v)):
            return [], False
    elif isinstance(v, str):
        items = [t.strip() for t in _TAG_SPLIT.split(v)]
    else:
        return [], False
    out: list[str] = []
    for t in items:
        if t and t not in out:
            out.append(t[:60])
    return out[:20], True


def as_html(text: str) -> str:
    """نص عادي -> فقرات <p> (تهريب فقط، بلا تغيير الحروف). HTML يبقى كما هو."""
    if _HTML_TAG.search(text):
        return text
    paras = [p.strip() for p in re.split(r"\r?\n\s*\r?\n", text) if p.strip()]
    return "".join(
        "<p>" + "<br>".join(html.escape(line, quote=False) for line in p.splitlines()) + "</p>" for p in paras
    )


def _slug_from(source_id: str | None, title_en: str | None) -> str | None:
    if source_id:
        s = slugify(source_id)
        if s:
            return f"post-{s}" if s.isdigit() else s
    s = slugify(title_en)
    return s or None


# ============ التحقق ============
def _validate(raw: list, sections: list[dict], existing_slugs: set[str]) -> list[tuple[ImportRow, dict | None]]:
    by_slug = {s["slug"]: s for s in sections}
    # القسم الافتراضي لكل مسار: أول قسم رئيسي مفعّل (ثم أي قسم) بالترتيب
    default_section: dict[str, dict] = {}
    for s in sorted(sections, key=lambda s: (s["parent_id"] is not None, not s["is_active"], s["sort_order"], s["id"])):
        default_section.setdefault(s["category"], s)

    seen: dict[str, int] = {}
    out: list[tuple[ImportRow, dict | None]] = []
    for i, item in enumerate(raw, start=1):
        row = ImportRow(index=i)
        if not isinstance(item, dict):
            row.errors.append("الصف ليس كائناً (يجب أن يكون {\"title_ar\": …})")
            out.append((row, None))
            continue
        item = {str(k).strip().lower(): v for k, v in item.items()}
        unknown = [k for k in item if k not in COLUMNS and k not in ("slug",)]
        if unknown:
            row.warnings.append("أعمدة غير معروفة تم تجاهلها: " + "، ".join(unknown[:5]))

        vals = {k: _str(item.get(k)) for k in COLUMNS if k != "tags"}
        for k in REQUIRED:
            if not vals[k]:
                row.errors.append(f"حقل ناقص: {FIELD_AR[k]}")
        row.source_id, row.title_ar, row.title_en = vals["id"], vals["title_ar"], vals["title_en"]
        row.topic = vals["topic"]
        row.has_en = bool(vals["content_en"])
        row.content_chars = len(vals["content_ar"] or "")

        cat = vals["category"]
        if cat and cat not in CATEGORIES:
            row.errors.append(f"مسار غير معروف «{cat}». المسموح: " + "، ".join(CATEGORIES))
            cat = None
        row.category = cat

        section = None
        if vals["section_slug"]:
            section = by_slug.get(vals["section_slug"])
            if not section:
                row.errors.append(f"القسم «{vals['section_slug']}» غير موجود — أنشئه أولاً من «الأقسام»")
            elif cat and section["category"] != cat:
                row.errors.append(f"القسم «{section['name_ar']}» يتبع مساراً آخر ({section['category']}) لا {cat}")
                section = None
        elif cat:
            section = default_section.get(cat)
            if section:
                row.warnings.append(f"لم يُحدد section_slug: سيُوضع في «{section['name_ar']}»")
            else:
                row.errors.append(f"لا يوجد أي قسم في المسار {cat} — أنشئ قسماً أولاً أو حدد section_slug")
        if section:
            row.section_id, row.section_name = section["id"], section["name_ar"]
            if not section["is_active"]:
                row.warnings.append("القسم موقوف: لن تظهر المادة في الموقع حتى تفعيله")

        ctype = vals["content_type"] or "article"
        if ctype not in CONTENT_TYPES:
            row.errors.append(f"نوع محتوى غير معروف «{ctype}». المسموح: " + "، ".join(CONTENT_TYPES))
        row.content_type = ctype

        tags, ok = _tags(item.get("tags"))
        if not ok:
            row.errors.append("الوسوم يجب أن تكون قائمة نصوص أو نصاً مفصولاً بـ |")
        row.tags = tags

        given_slug = _str(item.get("slug"))
        if given_slug and not _SLUG_RE.match(given_slug):
            row.errors.append("الرابط المختصر (slug) بصيغة غير صحيحة: حروف إنجليزية صغيرة وأرقام وشرطات فقط")
            given_slug = None
        slug = given_slug or _slug_from(vals["id"], vals["title_en"])
        if slug:
            if slug in existing_slugs:
                row.errors.append(f"slug مكرر: «{slug}» مستخدم لمادة موجودة")
            elif slug in seen:
                row.errors.append(f"slug مكرر: «{slug}» مستخدم في الصف {seen[slug]} من نفس الملف")
            else:
                seen[slug] = i
        else:
            row.warnings.append("بلا id أو عنوان إنجليزي: سيُولَّد رابط مختصر تلقائياً")
        row.slug = slug

        for k in ("external_ref", "file_url"):
            if vals[k] and not re.match(r"^https?://", vals[k]):
                row.errors.append(f"{FIELD_AR[k]} يجب أن يبدأ بـ http:// أو https://")

        data = None
        if not row.errors:
            data = {
                "section_id": row.section_id, "title_ar": vals["title_ar"], "title_en": vals["title_en"],
                "content_ar": as_html(vals["content_ar"]),
                "content_en": as_html(vals["content_en"]) if vals["content_en"] else None,
                "summary_ar": vals["summary_ar"], "tags": tags, "external_ref": vals["external_ref"],
                "topic": vals["topic"], "source_name": vals["source_name"], "content_type": ctype,
                "file_url": vals["file_url"],
            }
        out.append((row, data))
    return out


def _unique_random_slug(taken: set[str]) -> str:
    while True:
        s = f"post-{secrets.randbelow(900_000) + 100_000}"
        if s not in taken:
            return s


@router.post("/import", response_model=ImportResult, summary="استيراد مواد من JSON/CSV (dry_run=true للمعاينة)")
def import_posts(body: ImportRequest, user: User = Depends(require_admin_user)) -> ImportResult:
    raw = _parse(body.format, body.content)
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "الملف لا يحتوي أي صف")
    if len(raw) > MAX_ROWS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"الحد الأقصى {MAX_ROWS} صف في الاستيراد الواحد")

    sb = get_supabase()
    sections = sb.table("sections").select("id, parent_id, name_ar, slug, category, sort_order, is_active").execute().data
    existing = {r["slug"] for r in fetch_all(lambda: sb.table("posts").select("slug").order("id"))}
    checked = _validate(raw, sections, existing)

    created = 0
    if not body.dry_run:
        taken = existing | {r.slug for r, _ in checked if r.slug}
        for row, data in checked:
            if data is None:
                continue
            slug = row.slug or _unique_random_slug(taken)
            taken.add(slug)
            ins = sb.table("posts").insert({
                **data, "slug": slug, "status": body.status, "created_by": user.id,
            }).execute().data[0]
            row.slug, row.created_id = slug, ins["id"]
            created += 1

    rows = [r for r, _ in checked]
    valid = sum(1 for r in rows if not r.errors)
    return ImportResult(
        dry_run=body.dry_run, status=body.status, total=len(rows), valid=valid,
        invalid=len(rows) - valid, created=created, rows=rows,
    )
