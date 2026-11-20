"""اختبار سريع شامل عبر TestClient (على قاعدة Supabase الحقيقية، ويحذف ما ينشئه).

تسجيل دخول -> إنشاء قسم تجريبي -> إنشاء منشور -> نشره -> قراءته من المسار العام -> حذف المنشور والقسم.
التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe smoke_test.py
"""
import secrets
import sys

from fastapi.testclient import TestClient

from app.config import redact, settings
from app.db import get_supabase
from app.main import app
from app.security import hash_password

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = TestClient(app, raise_server_exceptions=False)
results: list[bool] = []


def step(name: str, ok: bool, info: str = "") -> bool:
    results.append(bool(ok))
    print(f"{'✅' if ok else '❌'} {name}" + (f" — {redact(info)}" if info else ""))
    return bool(ok)


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

        # 6) سير المراجعة + فلاتر اللوحة + حسابي (الخطوة 6)
        workflow_checks(headers, section_id, post_id)
        account_checks(tag)
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


def workflow_checks(headers: dict, section_id: int, post_id: int) -> None:
    r = client.get(f"/api/admin/posts/{post_id}", headers=headers)
    step("GET منشور واحد مع اسم المحرر والمراجع", r.status_code == 200
         and r.json().get("created_by_name") and r.json().get("reviewed_by_name"),
         f"{r.json().get('created_by_name')} / {r.json().get('reviewed_by_name')}" if r.is_success else detail(r))

    def total(**params) -> int | None:
        r = client.get("/api/admin/posts", headers=headers, params={"section_id": section_id, **params})
        return r.json()["total"] if r.is_success else None

    step("فلتر اللغة: en = 0 و ar_only = 1 (المنشور بلا نسخة إنجليزية)",
         total(lang="en") == 0 and total(lang="ar_only") == 1)

    r = client.post(f"/api/admin/posts/{post_id}/return-to-draft", headers=headers,
                    json={"note": "ملاحظة مراجعة تجريبية"})
    b = r.json() if r.is_success else {}
    step("إرجاع منشور منشور إلى مسودة", r.status_code == 200 and b.get("status") == "draft"
         and b.get("published_at") is None and b.get("indexed_at") is None,
         f"note_saved={b.get('note_saved')}" if r.is_success else detail(r))
    r = client.post(f"/api/admin/posts/{post_id}/return-to-draft", headers=headers)
    step("إرجاع مسودة إلى مسودة يُرفض", r.status_code == 400, detail(r))

    r = client.put(f"/api/admin/posts/{post_id}", headers=headers, json={"status": "review"})
    step("إرسال للمراجعة", r.status_code == 200 and r.json()["status"] == "review", detail(r))
    step("GET /api/admin/posts?status=review يرجعه", total(status="review") == 1 and total(status="draft") == 0)
    r = client.post(f"/api/admin/posts/{post_id}/return-to-draft", headers=headers, json={})
    step("إرجاع منشور قيد المراجعة إلى مسودة (بدون ملاحظة)",
         r.status_code == 200 and r.json()["status"] == "draft", detail(r))

    r = client.get("/api/admin/dashboard/activity", headers=headers)
    step("GET /api/admin/dashboard/activity", r.status_code == 200
         and any(e.get("post_id") == post_id for e in r.json()), f"{len(r.json())} حدث" if r.is_success else detail(r))
    r = client.get("/api/admin/dashboard/system-status", headers=headers, params={"refresh": "true"})
    b = r.json() if r.is_success else {}
    step("GET /api/admin/dashboard/system-status", r.status_code == 200 and len(b.get("items", [])) == 4
         and b["items"][0]["state"] == "ok",
         ", ".join(f"{i['key']}={i['state']}" for i in b.get("items", [])) if r.is_success else detail(r))


def account_checks(tag: str) -> None:
    """حسابي: على مستخدم مؤقت (لا يُمس حساب المدير)، ويُحذف في النهاية."""
    sb = get_supabase()
    email, pw, new_pw = f"tmp-{tag}@example.com", f"Tmp-{tag}-pass1", f"Tmp-{tag}-pass2"
    uid = sb.table("users").insert({"name": "مستخدم مؤقت", "email": email,
                                    "password_hash": hash_password(pw), "role": "editor"}).execute().data[0]["id"]
    try:
        r = client.post("/api/auth/login", json={"email": email, "password": pw})
        if not step("دخول مستخدم مؤقت", r.status_code == 200, detail(r)):
            return
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.put("/api/auth/me", headers=h, json={"name": "اسم معدّل"})
        step("PUT /api/auth/me (الاسم)", r.status_code == 200 and r.json()["name"] == "اسم معدّل", detail(r))
        r = client.put("/api/auth/me", headers=h, json={"email": settings.admin_email})
        step("PUT /api/auth/me ببريد مستخدم آخر → 409", r.status_code == 409, detail(r))
        new_email = f"tmp2-{tag}@Example.com"
        r = client.put("/api/auth/me", headers=h, json={"email": new_email})
        step("PUT /api/auth/me (البريد، يُحفظ بأحرف صغيرة)", r.status_code == 200
             and r.json()["email"] == new_email.lower(), detail(r))
        r = client.put("/api/auth/me/password", headers=h, json={"current_password": "wrong", "new_password": new_pw})
        step("تغيير كلمة المرور بكلمة حالية خاطئة → 400", r.status_code == 400, detail(r))
        r = client.put("/api/auth/me/password", headers=h, json={"current_password": pw, "new_password": "short"})
        step("كلمة مرور جديدة قصيرة → 422", r.status_code == 422, detail(r))
        r = client.put("/api/auth/me/password", headers=h, json={"current_password": pw, "new_password": new_pw})
        step("PUT /api/auth/me/password", r.status_code == 200, detail(r))
        ok_new = client.post("/api/auth/login", json={"email": new_email, "password": new_pw}).status_code == 200
        ok_old = client.post("/api/auth/login", json={"email": new_email, "password": pw}).status_code == 401
        step("الدخول بكلمة المرور الجديدة فقط", ok_new and ok_old)
    finally:
        sb.table("users").delete().eq("id", uid).execute()
        step("حذف المستخدم المؤقت", True)


if __name__ == "__main__":
    sys.exit(main())
