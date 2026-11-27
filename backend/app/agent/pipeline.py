"""مسار الإيجنت الكامل: تصنيف + بحث -> قرار (match / fallback) -> اقتباس حرفي -> بناء الرد.

القاعدة الذهبية: المقتطفات المعروضة مأخوذة حرفياً من جدول posts عند حدود الجمل الكاملة.
النموذج يكتب فقط جملة التوجيه (من العنوان واسم القسم)، يصنّف السؤال، ويحدد أرقام جمل الاقتباس.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException

from ..cache import cached_public
from ..db import get_supabase
from ..models import AISettings
from ..rag.embeddings import EmbeddingError, embed_query
from ..rag.search import pick_matches, search
from .classifier import classify
from .extractor import extract_excerpts
from .guidance import make_guidance

_POST_COLUMNS = (
    "id, slug, status, title_ar, title_en, content_ar, content_en, summary_ar, "
    "source_name, external_ref, file_url, content_type, section:sections(name_ar, name_en, slug)"
)
_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="agent")


def _brief(r: dict) -> dict:
    return {
        "post_id": r["post_id"], "slug": r["slug"], "title": r["title"],
        "section": r["section"], "similarity": r["similarity"],
    }


@cached_public  # يُبطل عند أي تعديل في اللوحة، فلا يُعرض منشور أُلغي نشره
def _load_post(post_id: int) -> dict | None:
    rows = (
        get_supabase().table("posts").select(_POST_COLUMNS)
        .eq("id", post_id).eq("status", "published").limit(1).execute().data
    )
    return rows[0] if rows else None


def build_post_payload(post: dict, lang: str) -> dict:
    """النص المعتمد حرفياً باللغة المطلوبة، وإن لم تتوفر الإنجليزية -> العربية + lang_fallback."""
    use_en = lang == "en" and bool(post.get("content_en"))
    sec = post.get("section") or {}
    return {
        "id": post["id"],
        "slug": post["slug"],
        "title": (post.get("title_en") or post["title_ar"]) if use_en else post["title_ar"],
        "section": (sec.get("name_en") or sec.get("name_ar")) if use_en else sec.get("name_ar"),
        "content": post["content_en"] if use_en else post["content_ar"],
        "lang": "en" if use_en else "ar",
        "lang_fallback": lang == "en" and not use_en,
        "summary": post.get("summary_ar"),
        "source_name": post.get("source_name"),
        "external_ref": post.get("external_ref"),
        "file_url": post.get("file_url"),
        "content_type": post.get("content_type"),
    }


@cached_public
def _referrals() -> list[dict]:
    return (
        get_supabase().table("referral_centers").select("id, name, country, url, contact")
        .order("id").execute().data or []
    )


def _post_url(slug: str, lang: str) -> str:
    return f"/posts/{slug}?lang=en" if lang == "en" else f"/posts/{slug}"


def run_agent(message: str, lang: str, cfg: AISettings, *, show_errors: bool = False) -> dict:
    """يرجع {response, details}. response = ما يراه المستخدم، details = للمختبر والسجل.
    show_errors: تفاصيل خطأ Gemini في الرد (للمختبر في اللوحة فقط)؛ الزائر يرى رسالة عامة."""
    f_class = _pool.submit(classify, message)
    f_vec = _pool.submit(embed_query, message)
    try:
        vector = f_vec.result()
    except EmbeddingError as e:
        logging.getLogger("daiah").warning("embed_query failed: %s", e)
        raise HTTPException(
            503, f"المساعد غير متاح مؤقتاً: {e}" if show_errors else "المساعد غير متاح مؤقتاً، حاول بعد قليل"
        ) from None
    results = search(message, lang, cfg.top_k, query_vector=vector)
    classification = f_class.result()
    reply_lang = classification["lang"]  # لغة جملة التوجيه/رسالة البدائل = لغة السؤال

    # المواد المختارة: كل النتائج بترتيب الدمج التي تشابهها الدلالي ≥ العتبة (حتى 3 مصادر)
    matches = pick_matches(results, cfg.similarity_threshold)
    loaded: list[tuple[dict, dict]] = []
    for m in matches:
        p = _load_post(m["post_id"])
        if p:
            loaded.append((m, p))

    top = loaded[0][0] if loaded else (results[0] if results else None)

    if loaded:
        payloads = [(m, build_post_payload(p, lang)) for m, p in loaded]
        excerpts, ext_meta = extract_excerpts(
            message,
            [
                {
                    "id": pl["id"],
                    "lang": pl["lang"],
                    "content": pl["content"],
                    "matched_chunks": m.get("matched_chunks") or [m["best_chunk"]],
                }
                for m, pl in payloads
            ],
        )
        items: list[dict] = []
        for m, pl in payloads:
            ex = excerpts[pl["id"]]
            items.append({
                "id": pl["id"],
                "slug": pl["slug"],
                "url": _post_url(pl["slug"], pl["lang"]),
                "title": pl["title"],
                "section": pl["section"],
                "content": ex["html"],
                "excerpt_text": ex["text"],
                "is_excerpt": ex["is_excerpt"],
                "truncated_start": ex["truncated_start"],
                "truncated_end": ex["truncated_end"],
                "word_count": ex["word_count"],
                "similarity": m["similarity"],
                "lang": pl["lang"],
                "lang_fallback": pl["lang_fallback"],
                "source_name": pl["source_name"],
                "external_ref": pl["external_ref"],
                "file_url": pl["file_url"],
                "content_type": pl["content_type"],
            })

        shown_ids = {it["id"] for it in items}
        guidance = make_guidance(
            items[0]["title"],
            items[0]["section"] or "",
            reply_lang,
            cfg.guidance_prompt,
            source_count=len(items),
            titles=[it["title"] for it in items],
        )
        response = {
            "type": "match",
            "guidance": guidance["text"],
            "items": items,
            "related": [_brief(r) for r in results if r["post_id"] not in shown_ids][:3],
            "sources": [_brief(r) for r in results],
            "threshold": cfg.similarity_threshold,
        }
    else:
        guidance = None
        ext_meta = {"source": None, "model": None}
        response = {
            "type": "fallback",
            "message": cfg.fallback_message_en if reply_lang == "en" else cfg.fallback_message_ar,
            "closest": _brief(top) if top else None,
            "referrals": _referrals(),
            "sources": [_brief(r) for r in results],
            "threshold": cfg.similarity_threshold,
        }

    details = {
        "classification": classification,
        "requested_lang": lang,
        "threshold": cfg.similarity_threshold,
        "top_k": cfg.top_k,
        "top_score": top["similarity"] if top else None,
        "decision": response["type"],
        "matched_count": len(loaded),
        "results": [
            {**_brief(r), "above_threshold": r["similarity"] >= cfg.similarity_threshold,
             "chunk_lang": r["chunk_lang"], "best_chunk": r["best_chunk"],
             "text_score": r.get("text_score"), "sem_rank": r.get("sem_rank"), "text_rank": r.get("text_rank")}
            for r in results
        ],
        "search_mode": results[0].get("mode") if results else None,
        "guidance_source": guidance["source"] if guidance else None,
        "guidance_model": guidance["model"] if guidance else None,
        "extractor_source": ext_meta["source"],
        "extractor_model": ext_meta["model"],
        "settings_version": cfg.version,
    }
    return {"response": response, "details": details, "top": top}
