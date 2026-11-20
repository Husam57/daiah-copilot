r"""يشغّل frontend/scripts/e2e-check.mjs ببيانات المدير من إعدادات التطبيق (مثل smoke_test.py) دون طباعتها.

المتطلبات: الـ Backend (:8000) والواجهة (:3000) يعملان.
التشغيل (من مجلد backend):  .venv\Scripts\python.exe e2e_run.py
"""
import os
import subprocess
import sys

from app.config import BACKEND_DIR, settings

script = BACKEND_DIR.parent / "frontend" / "scripts" / "e2e-check.mjs"
env = {**os.environ, "E2E_EMAIL": settings.admin_email, "E2E_PASSWORD": settings.admin_password}
sys.exit(subprocess.call(["node", str(script)], env=env, cwd=str(script.parent.parent)))
