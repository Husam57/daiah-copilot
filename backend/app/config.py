"""إعدادات التطبيق: تُقرأ من backend/.env (لا تُطبع قيمها أبداً)."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(ENV_PATH)

# أبعاد متجه Gemini (output_dimensionality=768) — فهرس HNSW لا يدعم أكثر من 2000 بُعد
EMBEDDING_DIM = 768

# أسماء نماذج Gemini (ليست أسراراً؛ يمكن تغييرها من .env)
EMBEDDING_MODEL = (os.getenv("GEMINI_EMBED_MODEL") or "gemini-embedding-001").strip()
# سلسلة نماذج Flash تُجرَّب بالترتيب (بعضها يرجع 503 وقت الضغط)؛ مفصولة بفواصل
CHAT_MODELS = tuple(
    m.strip() for m in (
        os.getenv("GEMINI_CHAT_MODELS") or "gemini-3.5-flash-lite,gemini-3.8-flash"
    ).split(",") if m.strip()
)
CHAT_TIMEOUT_MS = 15_000  # مهلة كل محاولة توليد

TABLES = (
    "users", "sections", "posts", "post_chunks",
    "ai_settings", "ai_settings_history", "referral_centers", "chat_logs",
)


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_key: str
    gemini_api_key: str
    jwt_secret: str
    admin_email: str
    admin_password: str
    cors_origins: tuple[str, ...]
    is_production: bool


# الإنتاج: Render يضبط RENDER=true تلقائياً، أو APP_ENV=production يدوياً
IS_PRODUCTION = _env("APP_ENV").lower() == "production" or _env("RENDER").lower() == "true"


def _cors_origins() -> tuple[str, ...]:
    """CORS_ORIGINS: روابط الواجهة مفصولة بفواصل (بلا / في النهاية). في الإنتاج لا يُسمح إلا بها،
    ولا تُقبل * (مع allow_credentials)؛ وفي التطوير الافتراضي http://localhost:3000."""
    raw = _env("CORS_ORIGINS")
    origins = tuple(dict.fromkeys(o.strip().rstrip("/") for o in raw.split(",") if o.strip() and o.strip() != "*"))
    if origins or IS_PRODUCTION:
        return origins
    return ("http://localhost:3000",)


settings = Settings(
    supabase_url=_env("SUPABASE_URL"),
    supabase_service_key=_env("SUPABASE_SERVICE_KEY"),
    gemini_api_key=_env("GEMINI_API_KEY"),
    jwt_secret=_env("JWT_SECRET"),
    admin_email=_env("ADMIN_EMAIL"),
    admin_password=os.getenv("ADMIN_PASSWORD") or "",
    cors_origins=_cors_origins(),  # ليس سراً
    is_production=IS_PRODUCTION,
)

SECRET_KEYS = ("SUPABASE_SERVICE_KEY", "GEMINI_API_KEY", "JWT_SECRET", "ADMIN_PASSWORD")


def redact(text: str) -> str:
    """يحذف أي قيمة سرية من نص قبل طباعته."""
    for key in SECRET_KEYS:
        val = (os.getenv(key) or "").strip()
        if val:
            text = text.replace(val, "***")
    return text
