"""قراءة صف ai_settings الفعّال.

- اللوحة والمختبر يقرآنه من القاعدة في كل طلب.
- /api/chat يستخدم نسخة مخزنة 15 ث (cached=True) تُبطل فوراً عند حفظ الإعدادات أو استرجاعها
  من اللوحة (middleware في main.py)، فتسري التعديلات مباشرة.
"""
from fastapi import HTTPException

from .cache import TTLCache
from .db import get_supabase
from .models import AISettings

SETTINGS_TTL = 15.0
settings_cache = TTLCache(maxsize=1, ttl=SETTINGS_TTL, name="ai_settings")


def get_active_settings(cached: bool = False) -> AISettings:
    if cached:
        hit = settings_cache.get("active")
        if hit is not None:
            return hit
    rows = (
        get_supabase().table("ai_settings").select("*")
        .eq("is_active", True).limit(1).execute().data
    )
    if not rows:
        raise HTTPException(503, "لا يوجد صف إعدادات فعّال في ai_settings — شغّل init_db.py")
    cfg = AISettings(**rows[0])
    settings_cache.set("active", cfg)
    return cfg
