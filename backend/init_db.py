"""البيانات الأولية عبر supabase-py: صف ai_settings + مستخدم admin.

لا ينشئ جداول: أنشئها أولاً بلصق db/schema.sql في Supabase SQL Editor.
آمن للتشغيل أكثر من مرة: لا يكرر صف الإعدادات ولا مستخدم admin.
التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe init_db.py
"""
import sys

import bcrypt
from postgrest.exceptions import APIError

from app.config import ENV_PATH, TABLES, redact, settings
from app.db import get_supabase
from app.models import AISettingsCreate, UserCreate

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

GUIDANCE_PROMPT = (
    "- كن مهذباً ولطيفاً، وابدأ بعبارة ترحيبية قصيرة.\n"
    "- اجعل جملة التوجيه قصيرة وواضحة (جملة أو جملتان).\n"
    "- خاطب السائل بلغة سؤاله (العربية أو الإنجليزية).\n"
    "- لا تُضف أي معلومة شرعية من عندك؛ وجّه السائل فقط إلى المادة المعروضة."
)
FALLBACK_AR = (
    "عذراً، لا تتوفر لدينا حالياً إجابة موثّقة على هذا السؤال ضمن المواد المعتمدة. "
    "يمكنك الاطلاع على أقرب مادة ذات صلة أدناه، أو التواصل مع أحد المراكز المختصة المذكورة."
)
FALLBACK_EN = (
    "Sorry, a verified answer to this question is not currently available in our approved "
    "materials. You may review the closest related material below, or contact one of the "
    "listed specialized centers."
)


def fail(msg: str) -> None:
    print(f"❌ {msg}")
    sys.exit(1)


def check_env() -> None:
    if not ENV_PATH.exists():
        fail(f"الملف {ENV_PATH.name} غير موجود في backend/")
    missing = [
        name for name, val in (
            ("SUPABASE_URL", settings.supabase_url),
            ("SUPABASE_SERVICE_KEY", settings.supabase_service_key),
            ("ADMIN_EMAIL", settings.admin_email),
            ("ADMIN_PASSWORD", settings.admin_password),
        ) if not val
    ]
    if missing:
        fail("متغيرات ناقصة في .env: " + ", ".join(missing))
    if len(settings.admin_password) < 8:
        fail("ADMIN_PASSWORD يجب ألا يقل عن 8 أحرف")
    if len(settings.admin_password.encode("utf-8")) > 72:
        fail("ADMIN_PASSWORD أطول من 72 بايت (حد bcrypt)")


def count_rows(sb, table: str) -> int:
    return sb.table(table).select("id", count="exact").limit(1).execute().count or 0


def check_tables(sb) -> None:
    missing = []
    for table in TABLES:
        try:
            count_rows(sb, table)
        except APIError as e:
            if e.code in ("PGRST205", "42P01"):
                missing.append(table)
            else:
                raise
    if missing:
        fail(
            "جداول غير موجودة: " + ", ".join(missing)
            + "\n   الصق backend/db/schema.sql في Supabase SQL Editor وشغّله أولاً."
        )


def seed_ai_settings(sb) -> None:
    n = count_rows(sb, "ai_settings")
    if n:
        print(f"⏭️  ai_settings: موجود مسبقاً ({n} صف) — لم يُضف شيء")
        return
    row = AISettingsCreate(
        guidance_prompt=GUIDANCE_PROMPT,
        similarity_threshold=0.75,
        top_k=5,
        fallback_message_ar=FALLBACK_AR,
        fallback_message_en=FALLBACK_EN,
        version=1,
        is_active=True,
    )
    sb.table("ai_settings").insert(row.model_dump(exclude_none=True, exclude={"suggested_questions"})).execute()  # تبقى الافتراضية الفارغة
    print("✅ ai_settings: أُنشئ صف الإعدادات الفعّال (threshold=0.75, top_k=5)")


def seed_admin(sb) -> None:
    email = settings.admin_email.lower()
    found = sb.table("users").select("id, role").eq("email", email).limit(1).execute().data
    if found:
        print(f"⏭️  users: المستخدم {email} موجود مسبقاً (id={found[0]['id']}, "
              f"role={found[0]['role']}) — لم يُعدّل")
        return
    pw_hash = bcrypt.hashpw(
        settings.admin_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    user = UserCreate(name="مدير النظام", email=email, password_hash=pw_hash, role="admin")
    created = sb.table("users").insert(user.model_dump()).execute().data
    print(f"✅ users: أُنشئ المستخدم admin {email} (id={created[0]['id']})")


def print_summary(sb) -> None:
    print("\n— ملخص —")
    for table in TABLES:
        print(f"   ✅ {table:<17} صفوف: {count_rows(sb, table)}")


def main() -> None:
    check_env()
    try:
        sb = get_supabase()
        check_tables(sb)
        seed_ai_settings(sb)
        seed_admin(sb)
        print_summary(sb)
    except SystemExit:
        raise
    except Exception as e:
        fail(f"{type(e).__name__}: {redact(str(e)).strip()}")
    print("\n🎉 اكتملت البيانات الأولية")


if __name__ == "__main__":
    main()
