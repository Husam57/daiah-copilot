"""قراءة صف ai_settings الفعّال (يُقرأ في كل طلب حتى تسري تعديلات اللوحة فوراً)."""
from fastapi import HTTPException

from .db import get_supabase
from .models import AISettings


def get_active_settings() -> AISettings:
    rows = (
        get_supabase().table("ai_settings").select("*")
        .eq("is_active", True).limit(1).execute().data
    )
    if not rows:
        raise HTTPException(503, "لا يوجد صف إعدادات فعّال في ai_settings — شغّل init_db.py")
    return AISettings(**rows[0])
