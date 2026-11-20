"""البحث المتجهي عبر RPC match_post_chunks، مع تجميع النتائج حسب المنشور (أعلى درجة)."""
from ..db import get_supabase
from .embeddings import embed_query
from .indexer import _vector_literal

CHUNKS_PER_POST = 4  # نطلب مقاطع أكثر من top_k لأن عدة مقاطع قد تكون لنفس المنشور


def _match(vec_literal: str, lang: str, count: int) -> list[dict]:
    return get_supabase().rpc(
        "match_post_chunks",
        {"query_embedding": vec_literal, "match_count": count, "lang": lang},
    ).execute().data or []


def search(
    query: str,
    lang: str = "ar",
    top_k: int = 5,
    query_vector: list[float] | None = None,
) -> list[dict]:
    """يرجع حتى top_k منشوراً مرتبة تنازلياً:
    {post_id, slug, title, section, similarity, best_chunk, chunk_lang}

    - lang=ar: يبحث في المقاطع العربية.
    - lang=en: يبحث في الإنجليزية والعربية معاً (النموذج متعدد اللغات) حتى لا تضيع
      المواد التي ليس لها نسخة إنجليزية بعد.
    """
    vec = _vector_literal(query_vector if query_vector is not None else embed_query(query))
    count = max(top_k * CHUNKS_PER_POST, 10)
    langs = ("en", "ar") if lang == "en" else ("ar",)

    best: dict[int, dict] = {}
    for chunk_lang in langs:
        for row in _match(vec, chunk_lang, count):
            pid = row["post_id"]
            if pid not in best or row["similarity"] > best[pid]["similarity"]:
                best[pid] = {
                    "post_id": pid, "similarity": float(row["similarity"]),
                    "best_chunk": row["chunk_text"], "chunk_lang": chunk_lang,
                }
    ranked = sorted(best.values(), key=lambda r: r["similarity"], reverse=True)[:top_k]
    if not ranked:
        return []

    posts = (
        get_supabase().table("posts")
        .select("id, slug, title_ar, title_en, section:sections(name_ar, name_en)")
        .in_("id", [r["post_id"] for r in ranked]).execute().data
    )
    meta = {p["id"]: p for p in posts}
    out = []
    for r in ranked:
        p = meta.get(r["post_id"])
        if not p:
            continue
        sec = p.get("section") or {}
        r.update({
            "slug": p["slug"],
            "title": (p.get("title_en") if lang == "en" else None) or p["title_ar"],
            "section": (sec.get("name_en") if lang == "en" else None) or sec.get("name_ar") or "",
            "similarity": round(r["similarity"], 4),
        })
        out.append(r)
    return out
