"""مسارات المساعد العامة: POST /api/chat + POST /api/chat/feedback (بدون JWT، مع حد للطلبات)."""
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import Field

from ..agent.pipeline import run_agent
from ..ai_config import get_active_settings
from ..db import get_supabase
from ..models import Lang, _Model
from ..schemas import MessageResponse

router = APIRouter(prefix="/api/chat", tags=["agent"])

# ============ حد الطلبات (في الذاكرة، لكل IP) ============
RATE_LIMIT = 20
RATE_WINDOW = 60.0
_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    # على Render الطلب يمر عبر proxy واحد يُلحق عنوان العميل في آخر X-Forwarded-For
    # (نأخذ الأخير لأن العميل يستطيع تزوير القيم الأولى)
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request) -> None:
    ip = client_ip(request)
    now = time.monotonic()
    with _lock:
        q = _hits[ip]
        while q and now - q[0] > RATE_WINDOW:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            retry = int(RATE_WINDOW - (now - q[0])) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"طلبات كثيرة، حاول بعد {retry} ثانية",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)
        if len(_hits) > 10_000:  # تنظيف عناوين قديمة حتى لا تكبر الذاكرة
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > RATE_WINDOW]:
                _hits.pop(k, None)


def reset_rate_limit() -> None:
    """للاختبارات فقط."""
    with _lock:
        _hits.clear()


# ============ النماذج ============
class ChatRequest(_Model):
    message: str = Field(min_length=1, max_length=1000)
    lang: Lang = "ar"  # لغة المادة المطلوبة
    session_id: str = Field(min_length=1, max_length=100)


class FeedbackRequest(_Model):
    log_id: int
    helpful: bool


# ============ المسارات ============
@router.post("", summary="سؤال للمساعد -> مادة معتمدة (match) أو بدائل (fallback)")
def chat(body: ChatRequest, request: Request) -> dict:
    check_rate_limit(request)
    cfg = get_active_settings(cached=True)
    out = run_agent(body.message, body.lang, cfg)
    resp, details, top = out["response"], out["details"], out["top"]

    category = details["classification"]["category"]
    log_row = {
        "session_id": body.session_id,
        "question": body.message,
        "detected_category": None if category == "unknown" else category,
        "lang": body.lang,
        # في fallback نحفظ أقرب مادة ودرجتها (تظهر في "الأسئلة غير المجابة")
        "matched_post_id": top["post_id"] if top else None,
        "score": top["similarity"] if top else None,
        "is_fallback": resp["type"] == "fallback",
    }
    row = get_supabase().table("chat_logs").insert(log_row).execute().data[0]
    return {**resp, "log_id": row["id"]}


@router.post("/feedback", response_model=MessageResponse, summary="تقييم رد: مفيد / غير مفيد")
def feedback(body: FeedbackRequest) -> MessageResponse:
    sb = get_supabase()
    rows = sb.table("chat_logs").select("id").eq("id", body.log_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "السجل غير موجود")
    sb.table("chat_logs").update({"feedback": 1 if body.helpful else -1}).eq("id", body.log_id).execute()
    return MessageResponse(detail="شكراً لتقييمك")
