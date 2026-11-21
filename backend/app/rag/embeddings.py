"""Embeddings عبر Gemini (google-genai): 768 بُعداً، متجهات مُطبَّعة، دفعات، وإعادة محاولة عند 429."""
import logging
import math
import random
import time
from functools import lru_cache
from typing import Literal

import httpx
from google import genai
from google.genai import errors, types

from ..cache import TTLCache
from ..config import EMBEDDING_DIM, EMBEDDING_MODEL, redact, settings
from .normalize import normalize_ar

log = logging.getLogger("daiah.rag")

TaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]

BATCH_SIZE = 50          # عدد النصوص في طلب واحد (حد Gemini 100)
MAX_RETRIES = 6          # لأخطاء 429 / 5xx
BASE_DELAY = 2.0         # ثوانٍ؛ تتضاعف مع كل محاولة
MAX_DELAY = 60.0
_RETRYABLE = {429, 500, 502, 503, 504}


class EmbeddingError(RuntimeError):
    """فشل الحصول على embeddings (الرسالة آمنة للعرض، بلا أسرار)."""


@lru_cache(maxsize=1)
def get_genai_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise EmbeddingError("GEMINI_API_KEY غير موجود في backend/.env")
    # مهلة 30 ث لكل طلب حتى لا يتعلق الخادم إذا تأخر Gemini
    return genai.Client(
        api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=30_000)
    )


def _normalize(vec: list[float]) -> list[float]:
    """تطبيع L2 — مطلوب لأن Gemini لا يطبّع المتجهات عند أبعاد أقل من 3072."""
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm > 0 else vec


def _embed_batch(texts: list[str], task_type: TaskType, max_retries: int) -> list[list[float]]:
    client = get_genai_client()
    config = types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBEDDING_DIM)
    for attempt in range(max_retries + 1):
        try:
            res = client.models.embed_content(model=EMBEDDING_MODEL, contents=texts, config=config)
            vectors = [list(e.values or []) for e in (res.embeddings or [])]
            if len(vectors) != len(texts) or any(len(v) != EMBEDDING_DIM for v in vectors):
                raise EmbeddingError("استجابة embeddings غير متوقعة من Gemini")
            return [_normalize(v) for v in vectors]
        except errors.APIError as e:
            code = getattr(e, "code", None)
            if code in _RETRYABLE and attempt < max_retries:
                delay = min(MAX_DELAY, BASE_DELAY * 2 ** attempt) + random.uniform(0, 1)
                log.warning("Gemini embed HTTP %s — إعادة المحاولة بعد %.1f ث", code, delay)
                time.sleep(delay)
                continue
            if code == 429:
                raise EmbeddingError("تجاوزت حصة Gemini (429)، حاول لاحقاً") from None
            raise EmbeddingError(f"خطأ من Gemini (HTTP {code}): {redact(str(e))[:200]}") from None
        except httpx.TimeoutException:
            if attempt < max_retries:
                time.sleep(min(MAX_DELAY, BASE_DELAY * 2 ** attempt))
                continue
            raise EmbeddingError("انتهت مهلة الاتصال بـ Gemini") from None
    raise EmbeddingError("فشل الحصول على embeddings بعد عدة محاولات")


def embed_texts(
    texts: list[str],
    task_type: TaskType = "RETRIEVAL_DOCUMENT",
    max_retries: int = MAX_RETRIES,
) -> list[list[float]]:
    """يرجع متجهاً مُطبّعاً (768) لكل نص، بنفس الترتيب."""
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        out.extend(_embed_batch(texts[i:i + BATCH_SIZE], task_type, max_retries))
    return out


# الأسئلة المتكررة: نفس السؤال بعد التوحيد = نفس المتجه (يوفر طلب Gemini كاملاً)
query_cache = TTLCache(maxsize=1000, ttl=6 * 3600, name="query_embeddings")


def embed_query(text: str) -> list[float]:
    """سؤال المستخدم (بعد normalize_ar) مع LRU+TTL. محاولتان إضافيتان فقط حتى لا ينتظر طويلاً."""
    key = (EMBEDDING_MODEL, normalize_ar(text) or text)
    vec = query_cache.get(key)
    if vec is None:
        vec = embed_texts([key[1]], "RETRIEVAL_QUERY", max_retries=2)[0]
        query_cache.set(key, vec)
    return vec
