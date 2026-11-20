"""عميل Supabase واحد (HTTPS) بمفتاح service role — للـ Backend فقط."""
from functools import lru_cache

from supabase import Client, create_client

from .config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """يرجع نفس العميل في كل مرة (يصلح أيضاً كـ Dependency في FastAPI)."""
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError("SUPABASE_URL أو SUPABASE_SERVICE_KEY غير موجود في backend/.env")
    return create_client(settings.supabase_url, settings.supabase_service_key)
