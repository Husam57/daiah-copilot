"""استدعاء نموذج Gemini Flash مع سلسلة نماذج بديلة ومهلة قصيرة (فشل كل النماذج -> None)."""
import logging

from google.genai import types

from ..config import CHAT_MODELS, CHAT_TIMEOUT_MS, redact
from ..rag.embeddings import get_genai_client

log = logging.getLogger("daiah.agent")


def generate(
    prompt: str,
    system: str,
    *,
    json_schema: dict | None = None,
    max_tokens: int = 200,
) -> tuple[str | None, str | None]:
    """يرجع (النص، اسم النموذج الذي نجح) أو (None, None) إذا فشلت كل النماذج."""
    try:
        client = get_genai_client()
    except Exception as e:  # noqa: BLE001
        log.warning("Gemini client unavailable: %s", redact(str(e)))
        return None, None
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0,
        max_output_tokens=max_tokens,
        http_options=types.HttpOptions(timeout=CHAT_TIMEOUT_MS),
        **(
            {"response_mime_type": "application/json", "response_json_schema": json_schema}
            if json_schema else {}
        ),
    )
    for model in CHAT_MODELS:
        try:
            res = client.models.generate_content(model=model, contents=prompt, config=config)
            text = (res.text or "").strip()
            if text:
                return text, model
        except Exception as e:  # noqa: BLE001 — 503/504/مهلة: جرّب النموذج التالي
            log.warning("Gemini %s failed: %s", model, redact(str(e))[:200])
    return None, None
