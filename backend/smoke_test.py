"""اختبار سريع شامل عبر TestClient (على قاعدة Supabase الحقيقية، ويحذف ما ينشئه).

تسجيل دخول -> إنشاء قسم تجريبي -> إنشاء منشور -> نشره -> قراءته من المسار العام -> حذف المنشور والقسم.
التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe smoke_test.py
"""
import secrets
import sys

from fastapi.testclient import TestClient

from app.config import redact, settings
from app.main import app

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = TestClient(app, raise_server_exceptions=False)
results: list[bool] = []


def step(name: str, ok: bool, info: str = "") -> bool:
    results.append(ok)
    print(f"{'✅' if ok else '❌'} {name}" + (f" — {redact(info)}" if info else ""))
    return ok


def detail(r) -> str:
    try:
        return f"HTTP {r.status_code}: {r.json().get('detail')}"
    except Exception:
        return f"HTTP {r.status_code}"


def main() -> int:
    if not settings.admin_email or not settings.admin_password:
        print("❌ ADMIN_EMAIL أو ADMIN_PASSWORD غير موجود في backend/.env")
        return 1

    r = client.get("/api/health")
    step("الخادم يعمل (/api/health)", r.status_code == 200, detail(r))

    r = client.get("/api/admin/sections")
    step("مسارات اللوحة ترفض الطلب بدون تسجيل دخول", r.status_code == 401, detail(r))

    # 1) تسجيل الدخول
    r = client.post("/api/auth/login", json={"email": settings.admin_email, "password": "wrong-pass"})
    step("كلمة مرور خاطئة تُرفض", r.status_code == 401, detail(r))

    r = client.post(
        "/api/auth/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    )
    if not step("تسجيل الدخول", r.status_code == 200, "" if r.status_code == 200 else detail(r)):
        return 1
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.get("/api/auth/me", headers=headers)
    step("GET /api/auth/me", r.status_code == 200, f"role={r.json().get('role')}" if r.is_success else detail(r))

    section_id = post_id = None
    tag = secrets.token_hex(3)
    try:
        # 2) إنشاء قسم تجريبي
        r = client.post("/api/admin/sections", headers=headers, json={
            "name_ar": "قسم تجريبي (smoke)", "name_en": f"Smoke Test {tag}",
            "category": "intro_islam", "sort_order": 999,
        })
        if not step("إنشاء قسم تجريبي", r.status_code == 201, f"slug={r.json().get('slug')}" if r.status_code == 201 else detail(r)):
            return 1
        section = r.json()
        section_id = section["id"]

        # 3) إنشاء منشور (بدون slug -> يُولَّد من title_en)
        r = client.post("/api/admin/posts", headers=headers, json={
            "section_id": section_id,
            "title_ar": "منشور تجريبي", "title_en": f"Smoke Post {tag}",
            "content_ar": "هذا نص تجريبي معتمد للاختبار.", "summary_ar": "ملخص تجريبي",
            "tags": ["اختبار"], "source_name": "اختبار آلي", "external_ref": "https://example.com",
        })
        if not step("إنشاء منشور (مسودة)", r.status_code == 201, f"slug={r.json().get('slug')}" if r.status_code == 201 else detail(r)):
            return 1
        post = r.json()
        post_id, slug = post["id"], post["slug"]
        step("slug مولّد من title_en", slug == f"smoke-post-{tag}", slug)

        r = client.post("/api/admin/posts", headers=headers, json={
            "section_id": section_id, "slug": slug, "title_ar": "مكرر", "content_ar": "نص",
        })
        step("slug مكرر يُرفض", r.status_code == 409, detail(r))

        r = client.get(f"/api/posts/{slug}")
        step("المسودة لا تظهر في المسار العام", r.status_code == 404, detail(r))

        r = client.get("/api/admin/posts", headers=headers, params={"section_id": section_id, "q": "تجريبي"})
        step("قائمة المنشورات مع الفلترة والبحث", r.status_code == 200 and r.json()["total"] == 1,
             f"total={r.json().get('total')}" if r.is_success else detail(r))

        r = client.get("/api/admin/sections", headers=headers)
        count = next((s["posts_count"] for s in r.json() if s["id"] == section_id), None) if r.is_success else None
        step("عدد المنشورات في القسم = 1", count == 1, f"posts_count={count}")

        # 4) النشر
        r = client.post(f"/api/admin/posts/{post_id}/publish", headers=headers)
        ok = r.status_code == 200 and r.json()["status"] == "published" and r.json()["published_at"]
        step("نشر المنشور", bool(ok), "" if ok else detail(r))

        # 5) القراءة من المسار العام
        r = client.get(f"/api/posts/{slug}")
        ok = r.status_code == 200 and r.json()["content_ar"] == post["content_ar"]
        step("قراءة المنشور من /api/posts/{slug} (النص حرفياً)", ok,
             f"القسم: {r.json()['section']['name_ar']}" if ok else detail(r))

        r = client.get(f"/api/sections/{section['slug']}/posts")
        step("ظهوره في /api/sections/{slug}/posts", r.status_code == 200 and r.json()["total"] == 1, detail(r))

        r = client.get("/api/sections")
        step("القسم ضمن الأقسام النشطة /api/sections",
             r.status_code == 200 and any(s["id"] == section_id for s in r.json()), detail(r))

        r = client.delete(f"/api/admin/sections/{section_id}", headers=headers)
        step("حذف قسم فيه منشورات يُرفض", r.status_code == 409, detail(r))
    finally:
        # 6) التنظيف
        if post_id is not None:
            r = client.delete(f"/api/admin/posts/{post_id}", headers=headers)
            step("حذف المنشور", r.status_code == 200, detail(r))
        if section_id is not None:
            r = client.delete(f"/api/admin/sections/{section_id}", headers=headers)
            step("حذف القسم", r.status_code == 200, detail(r))

    passed = sum(results)
    print(f"\n{'🎉' if all(results) else '⚠️ '} {passed}/{len(results)} خطوة نجحت")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
