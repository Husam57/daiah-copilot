"""مسار الإيجنت الكامل: تصنيف + بحث -> قرار (match / fallback) -> بناء الرد.

القاعدة الذهبية: post.content = content_ar/content_en من جدول posts حرفياً (لا يمر على أي نموذج).
النموذج يكتب فقط جملة التوجيه (من العنوان واسم القسم) ويصنّف السؤال.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException

from ..cache import cached_public
from ..db import get_supabase
from ..models import AISettings
from ..rag.embeddings import EmbeddingError, embed_query
from ..rag.search import pick_match, search
from .classifier import classify
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

    # المادة المختارة: أول نتيجة بترتيب الدمج (RRF) تشابهها الدلالي ≥ العتبة
    chosen = pick_match(results, cfg.similarity_threshold)
    top = chosen or (results[0] if results else None)
    post = _load_post(chosen["post_id"]) if chosen else None  # تحقق إضافي أنه ما زال منشوراً

    if post:
        payload = build_post_payload(post, lang)
        guidance = make_guidance(payload["title"], payload["section"] or "", reply_lang, cfg.guidance_prompt)
        response = {
            "type": "match",
            "guidance": guidance["text"],
            "post": payload,
            "related": [_brief(r) for r in results if r["post_id"] != top["post_id"]][:3],
            "sources": [_brief(r) for r in results],
            "threshold": cfg.similarity_threshold,
        }
    else:
        guidance = None
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
        "results": [
            {**_brief(r), "above_threshold": r["similarity"] >= cfg.similarity_threshold,
             "chunk_lang": r["chunk_lang"], "best_chunk": r["best_chunk"],
             "text_score": r.get("text_score"), "sem_rank": r.get("sem_rank"), "text_rank": r.get("text_rank")}
            for r in results
        ],
        "search_mode": results[0].get("mode") if results else None,
        "guidance_source": guidance["source"] if guidance else None,
        "guidance_model": guidance["model"] if guidance else None,
        "settings_version": cfg.version,
    }
    return {"response": response, "details": details, "top": top}
