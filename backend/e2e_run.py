r"""يشغّل frontend/scripts/e2e-check.mjs ببيانات المدير من إعدادات التطبيق (مثل smoke_test.py) دون طباعتها،
ثم يحذف سجلات المحادثة التي أنشأها السيناريو (session_id خاص بهذا التشغيل).

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
code = subprocess.call(["node", str(script)], env=env, cwd=str(script.parent.parent))
deleted = get_supabase().table("chat_logs").delete().eq("session_id", session).execute().data
print(f"🧹 حُذفت {len(deleted or [])} من سجلات المحادثة التجريبية")
sys.exit(code)
