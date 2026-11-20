"""فحص الإعداد: الاتصال بـ Supabase (HTTPS) ومفتاح Gemini — بدون طباعة أي قيمة سرية."""
import base64
import json
import sys

from app.config import ENV_PATH, EMBEDDING_DIM, TABLES, redact, settings

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def key_role(key: str) -> str:
    """نوع المفتاح فقط (service_role / anon / secret / publishable) — لا يطبع المفتاح."""
    if key.startswith("sb_secret_"):
        return "secret"
    if key.startswith("sb_publishable_"):
        return "publishable"
    try:
        payload = key.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role", "unknown")
    except Exception:
        return "unknown"


def check_supabase() -> bool:
    if not settings.supabase_url or not settings.supabase_service_key:
        print("❌ Supabase: SUPABASE_URL أو SUPABASE_SERVICE_KEY غير موجود في .env")
        return False
    role = key_role(settings.supabase_service_key)
    if role in ("anon", "publishable"):
        print(f"❌ Supabase: المفتاح من نوع {role} — المطلوب مفتاح service role / secret")
        return False

    from postgrest.exceptions import APIError

    from app.db import get_supabase

    try:
        sb = get_supabase()
        existing, missing = [], []
        for table in TABLES:
            try:
                sb.table(table).select("id").limit(1).execute()
                existing.append(table)
            except APIError as e:
                if e.code in ("PGRST205", "42P01"):  # الجدول غير موجود — لكن الاتصال يعمل
                    missing.append(table)
                else:
                    raise
        print(f"✅ Supabase: متصل عبر HTTPS — نوع المفتاح: {role}")
        if missing:
            print(f"   ⚠️  جداول لم تُنشأ بعد ({len(missing)}/{len(TABLES)}): {', '.join(missing)}")
            print("      الصق backend/db/schema.sql في Supabase SQL Editor وشغّله.")
        else:
            print(f"   ✅ الجداول السبعة موجودة")
        return True
    except Exception as e:
        print(f"❌ Supabase: {type(e).__name__}: {redact(str(e)).strip()}")
        return False


def check_gemini() -> bool:
    if not settings.gemini_api_key:
        print("❌ Gemini: GEMINI_API_KEY غير موجود في .env")
        return False
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents="اختبار",
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
        )
        dim = len(result.embeddings[0].values)
        mark = "✅" if dim == EMBEDDING_DIM else "⚠️ "
        print(f"{mark} Gemini: المفتاح يعمل — طول المتجه = {dim} (المطلوب {EMBEDDING_DIM})")
        return dim == EMBEDDING_DIM
    except Exception as e:
        print(f"❌ Gemini: {type(e).__name__}: {redact(str(e)).strip()}")
        return False


if __name__ == "__main__":
    if not ENV_PATH.exists():
        print(f"❌ الملف {ENV_PATH.name} غير موجود في backend/")
        sys.exit(1)
    ok_db = check_supabase()
    ok_ai = check_gemini()
    sys.exit(0 if (ok_db and ok_ai) else 1)
