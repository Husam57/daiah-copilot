r"""يشغّل frontend/scripts/e2e-check.mjs ببيانات المدير من إعدادات التطبيق (مثل smoke_test.py) دون طباعتها،
ثم يحذف سجلات المحادثة التي أنشأها السيناريو (session_id خاص بهذا التشغيل)،
ويعيد رقم إصدار الإعدادات ويحذف نسخ السجل التي أنشأها فحص الأسئلة المقترحة.

المتطلبات: الـ Backend (:8000) والواجهة (:3000) يعملان.
التشغيل (من مجلد backend):  .venv\Scripts\python.exe e2e_run.py
"""
import os
import secrets
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")  # الرموز التعبيرية حتى عند توجيه المخرجات
except Exception:
    pass

from app.config import BACKEND_DIR, settings
from app.db import get_supabase

script = BACKEND_DIR.parent / "frontend" / "scripts" / "e2e-check.mjs"
session = f"e2e-{secrets.token_hex(4)}"
env = {
    **os.environ,
    "E2E_EMAIL": settings.admin_email,
    "E2E_PASSWORD": settings.admin_password,
    "E2E_SESSION": session,
}
sb = get_supabase()
active = sb.table("ai_settings").select("id, version, suggested_questions").eq("is_active", True).limit(1).execute().data
hist = sb.table("ai_settings_history").select("id").order("id", desc=True).limit(1).execute().data
hist_max = hist[0]["id"] if hist else 0

code = subprocess.call(["node", str(script)], env=env, cwd=str(script.parent.parent))
deleted = sb.table("chat_logs").delete().eq("session_id", session).execute().data
print(f"🧹 حُذفت {len(deleted or [])} من سجلات المحادثة التجريبية")
if active:
    row = active[0]
    sb.table("ai_settings").update({"version": row["version"], "suggested_questions": row.get("suggested_questions") or []}
                                   ).eq("id", row["id"]).execute()
    h = sb.table("ai_settings_history").delete().gt("id", hist_max).execute().data
    print(f"🧹 أُعيد إصدار الإعدادات {row['version']} وحُذفت {len(h or [])} من نسخ سجلها التجريبية")
sys.exit(code)
