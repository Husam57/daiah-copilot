"""فهرسة المواد: posts (published فقط) -> مقاطع -> embeddings -> post_chunks + posts.indexed_at."""
import logging
from datetime import datetime, timezone

from ..db import get_supabase
from ..utils import fetch_all
from .chunking import chunk_text
from .embeddings import embed_texts
from .normalize import normalize_ar

log = logging.getLogger("daiah.rag")

_POST_COLUMNS = "id, status, title_ar, title_en, content_ar, content_en"
_INSERT_BATCH = 100


class IndexingError(RuntimeError):
    """فشل الفهرسة (الرسالة بالعربية وآمنة للعرض)."""


def _vector_literal(vec: list[float]) -> str:
    # صيغة pgvector النصية '[x,y,...]' — مضمونة عبر PostgREST
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"


def _load_post(post_id: int) -> dict:
    rows = get_supabase().table("posts").select(_POST_COLUMNS).eq("id", post_id).limit(1).execute().data
    if not rows:
        raise IndexingError("المنشور غير موجود")
    return rows[0]


def build_chunks(post: dict) -> list[tuple[str, int, str]]:
    """(lang, chunk_index, chunk_text) — كل لغة تُقطّع بنصها وعنوانها."""
    out: list[tuple[str, int, str]] = []
    for lang in ("ar", "en"):
        content = post.get(f"content_{lang}")
        title = post.get(f"title_{lang}") or (post.get("title_ar") if lang == "en" else None)
        for i, text in enumerate(chunk_text(content, title, lang)):
            out.append((lang, i, text))
    return out


def index_post(post_id: int) -> dict:
    """يعيد فهرسة منشور منشور: يحسب المقاطع الجديدة أولاً، ثم يستبدل القديمة ويحدّث indexed_at.

    (حساب embeddings قبل الحذف: إذا فشل Gemini يبقى الفهرس القديم كما هو.)
    """
    post = _load_post(post_id)
    if post["status"] != "published":
        raise IndexingError("لا يُفهرس إلا المنشور المنشور (published)")
    chunks = build_chunks(post)
    if not chunks:
        raise IndexingError("المنشور لا يحتوي نصاً قابلاً للفهرسة")
    # التضمين على النص الموحَّد (للبحث فقط)؛ chunk_text يُحفظ كما هو
    vectors = embed_texts([normalize_ar(c[2]) for c in chunks], "RETRIEVAL_DOCUMENT")

    sb = get_supabase()
    rows = [
        {"post_id": post_id, "lang": lang, "chunk_index": idx, "chunk_text": text,
         "embedding": _vector_literal(vec)}
        for (lang, idx, text), vec in zip(chunks, vectors)
    ]
    sb.table("post_chunks").delete().eq("post_id", post_id).execute()
    for i in range(0, len(rows), _INSERT_BATCH):
        sb.table("post_chunks").insert(rows[i:i + _INSERT_BATCH]).execute()
    now = datetime.now(timezone.utc).isoformat()
    sb.table("posts").update({"indexed_at": now}).eq("id", post_id).execute()
    langs = sorted({c[0] for c in chunks})
    log.info("indexed post %s: %d chunks (%s)", post_id, len(rows), ",".join(langs))
    return {"post_id": post_id, "chunks": len(rows), "langs": langs, "indexed_at": now}


def unindex_post(post_id: int) -> None:
    sb = get_supabase()
    sb.table("post_chunks").delete().eq("post_id", post_id).execute()
    sb.table("posts").update({"indexed_at": None}).eq("id", post_id).execute()


def reindex_all() -> dict:
    """يعيد فهرسة كل المنشورة، ويحذف مقاطع أي منشور غير منشور (تنظيف)."""
    sb = get_supabase()
    posts = fetch_all(lambda: sb.table("posts").select("id, status, indexed_at").order("id"))
    published = [p["id"] for p in posts if p["status"] == "published"]
    stray = [p["id"] for p in posts if p["status"] != "published" and p.get("indexed_at")]
    for pid in stray:
        unindex_post(pid)
    # مقاطع يتيمة لمنشورات غير منشورة لكن indexed_at فارغ
    chunk_posts = {
        r["post_id"] for r in fetch_all(lambda: sb.table("post_chunks").select("post_id").order("id"))
    }
    for pid in chunk_posts - set(published) - set(stray):
        unindex_post(pid)

    ok, failed, total_chunks = [], [], 0
    for pid in published:
        try:
            res = index_post(pid)
            ok.append(pid)
            total_chunks += res["chunks"]
        except Exception as e:  # noqa: BLE001 — نكمل بقية المنشورات
            failed.append({"post_id": pid, "error": str(e)[:200]})
    return {
        "indexed": len(ok), "failed": failed, "chunks": total_chunks,
        "unindexed": len(stray), "total_published": len(published),
    }
