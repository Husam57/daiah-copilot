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

TABLES = (
    "users", "sections", "posts", "post_chunks",
    "ai_settings", "referral_centers", "chat_logs",
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


settings = Settings(
    supabase_url=_env("SUPABASE_URL"),
    supabase_service_key=_env("SUPABASE_SERVICE_KEY"),
    gemini_api_key=_env("GEMINI_API_KEY"),
    jwt_secret=_env("JWT_SECRET"),
    admin_email=_env("ADMIN_EMAIL"),
    admin_password=os.getenv("ADMIN_PASSWORD") or "",
    # ليس سراً: نطاقات الواجهة المسموح لها (مفصولة بفواصل)
    cors_origins=tuple(
        o.strip() for o in (_env("CORS_ORIGINS") or "http://localhost:3000").split(",") if o.strip()
    ),
)

SECRET_KEYS = ("SUPABASE_SERVICE_KEY", "GEMINI_API_KEY", "JWT_SECRET", "ADMIN_PASSWORD")


def redact(text: str) -> str:
    """يحذف أي قيمة سرية من نص قبل طباعته."""
    for key in SECRET_KEYS:
        val = (os.getenv(key) or "").strip()
        if val:
            text = text.replace(val, "***")
    return text
