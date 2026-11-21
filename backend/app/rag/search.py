"""البحث: دلالي (match_post_chunks) أو هجين (match_post_chunks_hybrid: دلالي + نصي pg_trgm) بدمج RRF.

- النتيجة تُستخدم لاختيار المادة فقط؛ النص المعروض دائماً من جدول posts حرفياً.
- العتبة تبقى على درجة التشابه الدلالي (similarity) في كل الأوضاع.
- الوضع الهجين يتطلب تنفيذ db/schema.sql. إن لم تكن الدالة موجودة يرجع البحث تلقائياً للدلالي
  (ويعيد المحاولة كل 10 دقائق)، فلا يتعطل المساعد.
"""
import logging
import math
import os
import threading
import time

from postgrest.exceptions import APIError

from ..db import get_supabase
from .embeddings import embed_query
from .indexer import _vector_literal
from .normalize import normalize_ar

log = logging.getLogger("daiah.rag")

CHUNKS_PER_POST = 4  # نطلب مقاطع أكثر من top_k لأن عدة مقاطع قد تكون لنفس المنشور
RRF_K = 60           # ثابت Reciprocal Rank Fusion المعتاد
TEXT_MIN = 0.2       # أدنى word_similarity يُعتبر تطابقاً نصياً (أقل منه ضجيج حروف مشتركة)
SEARCH_MODES = ("semantic", "hybrid")
DEFAULT_MODE = (os.getenv("SEARCH_MODE") or "hybrid").strip()
_RETRY_HYBRID_AFTER = 600.0

_state = {"hybrid_missing_at": None}
_lock = threading.Lock()


def hybrid_available() -> bool:
    """False إن تبيّن أن دالة match_post_chunks_hybrid غير موجودة (خلال آخر 10 دقائق)."""
    with _lock:
        at = _state["hybrid_missing_at"]
        return at is None or time.monotonic() - at > _RETRY_HYBRID_AFTER


def _mark_hybrid_missing() -> None:
    with _lock:
        if _state["hybrid_missing_at"] is None:
            log.warning("match_post_chunks_hybrid غير موجودة — البحث دلالي فقط حتى تنفيذ db/schema.sql")
        _state["hybrid_missing_at"] = time.monotonic()


def _semantic_rows(vec: str, lang: str, count: int) -> list[dict]:
    rows = get_supabase().rpc(
        "match_post_chunks", {"query_embedding": vec, "match_count": count, "lang": lang},
    ).execute().data or []
    return [{**r, "text_score": None, "sem_rank": i + 1, "text_rank": None} for i, r in enumerate(rows)]


def _hybrid_rows(vec: str, query: str, lang: str, count: int) -> list[dict] | None:
    """None = الدالة غير موجودة (ارجع للدلالي)."""
    try:
        return get_supabase().rpc("match_post_chunks_hybrid", {
            "query_embedding": vec, "query_text": query, "match_count": count, "lang": lang,
            "text_min": TEXT_MIN,
        }).execute().data or []
    except APIError as e:
        if e.code in ("PGRST202", "42883"):  # الدالة غير موجودة في ذاكرة PostgREST / Postgres
            _mark_hybrid_missing()
            return None
        raise


def fuse(rows: list[dict], top_k: int) -> list[dict]:
    """يجمع المقاطع حسب المنشور ثم يرتّب بـ RRF على مستوى المنشور:
    rrf = 1/(k + رتبة المنشور دلالياً) + 1/(k + رتبته نصياً). المنشور بلا تطابق نصي يأخذ الجزء الدلالي فقط.
    similarity = أعلى تشابه دلالي لمقاطع المنشور (هي التي تُقارن بالعتبة)."""
    best: dict[int, dict] = {}
    for row in rows:
        pid = row["post_id"]
        sim = float(row["similarity"])
        ts = row.get("text_score")
        cur = best.setdefault(pid, {
            "post_id": pid, "similarity": -1.0, "best_chunk": "", "chunk_lang": row.get("chunk_lang"),
            "text_score": None, "text_chunk": None,
        })
        if sim > cur["similarity"]:
            cur.update(similarity=sim, best_chunk=row["chunk_text"], chunk_lang=row.get("chunk_lang"))
        if ts is not None and (cur["text_score"] is None or ts > cur["text_score"]):
            cur.update(text_score=float(ts), text_chunk=row["chunk_text"])
    posts = list(best.values())
    for rank, p in enumerate(sorted(posts, key=lambda p: p["similarity"], reverse=True), start=1):
        p["sem_rank"] = rank
    with_text = sorted((p for p in posts if p["text_score"] is not None), key=lambda p: p["text_score"], reverse=True)
    for rank, p in enumerate(with_text, start=1):
        p["text_rank"] = rank
    for p in posts:
        p.setdefault("text_rank", None)
        p["rrf"] = 1 / (RRF_K + p["sem_rank"]) + (1 / (RRF_K + p["text_rank"]) if p["text_rank"] else 0)
    posts.sort(key=lambda p: (p["rrf"], p["similarity"]), reverse=True)
    return posts[:top_k]


def pick_match(results: list[dict], threshold: float) -> dict | None:
    """المادة التي تُعرض: أول نتيجة بترتيب الدمج تشابهها الدلالي ≥ العتبة، وإلا None (fallback)."""
    return next((r for r in results if r["similarity"] >= threshold), None)


def search(
    query: str,
    lang: str = "ar",
    top_k: int = 5,
    query_vector: list[float] | None = None,
    mode: str | None = None,
) -> list[dict]:
    """يرجع حتى top_k منشوراً مرتبة (RRF في الهجين، التشابه في الدلالي):
    {post_id, slug, title, section, similarity, best_chunk, chunk_lang, text_score, sem_rank, text_rank, rrf, mode}

    - lang=ar: يبحث في المقاطع العربية.
    - lang=en: يبحث في الإنجليزية والعربية معاً (النموذج متعدد اللغات) حتى لا تضيع
      المواد التي ليس لها نسخة إنجليزية بعد.
    - mode: semantic | hybrid | hybrid_sim (محاكاة في بايثون للاختبار فقط). الافتراضي SEARCH_MODE أو hybrid.
    """
    mode = mode or DEFAULT_MODE
    vector = query_vector if query_vector is not None else embed_query(query)
    vec = _vector_literal(vector)
    count = max(top_k * CHUNKS_PER_POST, 10)
    langs = ("en", "ar") if lang == "en" else ("ar",)

    used = mode
    rows: list[dict] = []
    for chunk_lang in langs:
        part = None
        if mode == "hybrid" and hybrid_available():
            part = _hybrid_rows(vec, query, chunk_lang, count)
        elif mode == "hybrid_sim":
            part = _simulated_hybrid_rows(vector, query, chunk_lang, count)
        if part is None:
            used = "semantic"
            part = _semantic_rows(vec, chunk_lang, count)
        rows.extend({**r, "chunk_lang": chunk_lang} for r in part)
    ranked = fuse(rows, top_k)
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
            "text_score": round(r["text_score"], 4) if r["text_score"] is not None else None,
            "rrf": round(r["rrf"], 6),
            "mode": used,
        })
        out.append(r)
    return out


# ============ محاكاة الهجين (rag_test فقط، قبل تنفيذ SQL) ============
def _trigrams_ordered(text: str) -> list[str]:
    """مثل pg_trgm: حروف/أرقام فقط، كل كلمة تُحاط بـ «  » قبلها ومسافة بعدها."""
    out: list[str] = []
    word = []
    for ch in text.lower() + " ":
        if ch.isalnum():
            word.append(ch)
        elif word:
            w = "  " + "".join(word) + " "
            out.extend(w[i:i + 3] for i in range(len(w) - 2))
            word = []
    return out


def word_similarity_approx(query: str, doc: str) -> float:
    """تقريب word_similarity في pg_trgm: أعلى |A∩E| / |A∪E| لأي امتداد متصل E من ثلاثيات النص."""
    a = set(_trigrams_ordered(query))
    if not a:
        return 0.0
    seq = _trigrams_ordered(doc)
    hits = [i for i, t in enumerate(seq) if t in a]
    best = 0.0
    for x, i in enumerate(hits):
        seen: set[str] = set()
        for y, j in enumerate(hits[x:]):
            seen.add(seq[j])
            # ثلاثيات الامتداد التي ليست في A تزيد الاتحاد (y+1 = عدد المواضع المطابقة في الامتداد)
            union = len(a) + ((j - i + 1) - (y + 1))
            best = max(best, len(seen) / union)
    return best


def _simulated_hybrid_rows(vector: list[float], query: str, lang: str, count: int) -> list[dict]:
    """نفس منطق match_post_chunks_hybrid محسوباً في بايثون على كل المقاطع (للبيانات الصغيرة فقط)."""
    sb = get_supabase()
    chunks = (
        sb.table("post_chunks").select("id, post_id, chunk_text, embedding, post:posts!inner(status)")
        .eq("lang", lang).eq("post.status", "published").execute().data or []
    )
    q = normalize_ar(query)
    rows = []
    for c in chunks:
        emb = c["embedding"]
        emb = [float(x) for x in emb.strip("[]").split(",")] if isinstance(emb, str) else emb
        sim = sum(x * y for x, y in zip(vector, emb)) / (
            math.sqrt(sum(x * x for x in vector)) * math.sqrt(sum(y * y for y in emb)) or 1)
        rows.append({"id": c["id"], "post_id": c["post_id"], "chunk_text": c["chunk_text"], "similarity": sim,
                     "ts": word_similarity_approx(q, normalize_ar(c["chunk_text"]))})
    sem = {r["id"]: i + 1 for i, r in enumerate(sorted(rows, key=lambda r: -r["similarity"])[:count])}
    txt_sorted = [r for r in sorted(rows, key=lambda r: (-r["ts"], r["id"]))[:count] if r["ts"] >= TEXT_MIN]
    txt = {r["id"]: i + 1 for i, r in enumerate(txt_sorted)}
    return [
        {"post_id": r["post_id"], "chunk_text": r["chunk_text"], "similarity": r["similarity"],
         "text_score": r["ts"] if r["id"] in txt else None, "sem_rank": sem.get(r["id"]), "text_rank": txt.get(r["id"])}
        for r in rows if r["id"] in sem or r["id"] in txt
    ]
