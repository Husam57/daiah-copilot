"""أدوات مشتركة لاختبارات rag_test.py و agent_test.py: عميل، تسجيل دخول، بيانات تجريبية محايدة، تنظيف.

المحتوى التجريبي عام ومحايد (ليس محتوى شرعياً) ويُحذف بعد كل اختبار.
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
    results.append(bool(ok))
    print(f"{'✅' if ok else '❌'} {name}" + (f" — {redact(str(info))}" if info else ""), flush=True)
    return bool(ok)


def detail(r) -> str:
    try:
        return f"HTTP {r.status_code}: {r.json().get('detail')}"
    except Exception:
        return f"HTTP {r.status_code}"


def login() -> dict:
    if not settings.admin_email or not settings.admin_password:
        print("❌ ADMIN_EMAIL أو ADMIN_PASSWORD غير موجود في backend/.env")
        sys.exit(1)
    r = client.post("/api/auth/login", json={"email": settings.admin_email, "password": settings.admin_password})
    if r.status_code != 200:
        print(f"❌ تسجيل الدخول فشل: {detail(r)}")
        sys.exit(1)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


TAG = secrets.token_hex(3)

# ثلاث مواد مميزة جداً في الموضوع حتى يكون التطابق الصحيح واضحاً
POSTS = {
    "garden": {
        "title_ar": "زراعة الطماطم في حديقة المنزل",
        "title_en": "Growing Tomatoes in a Home Garden",
        "content_ar": (
            "<p>تحتاج نباتات الطماطم إلى ست ساعات على الأقل من ضوء الشمس المباشر يومياً، "
            "لذلك اختر مكاناً مشمساً في الحديقة أو على الشرفة.</p>"
            "<p>استخدم تربة خفيفة جيدة التصريف وغنية بالسماد العضوي، وازرع الشتلات على عمق "
            "يغطي جزءاً من الساق لتقوية الجذور.</p>"
            "<p>اسقِ النبات بانتظام في الصباح الباكر، وتجنب تبليل الأوراق حتى لا تنتشر الأمراض "
            "الفطرية. ثبّت النبات بدعامة خشبية عندما يطول.</p>"
        ),
        "content_en": (
            "<p>Tomato plants need at least six hours of direct sunlight every day, so choose a "
            "sunny spot in the garden or on the balcony.</p>"
            "<p>Use light, well-drained soil rich in compost, and water the plants regularly in "
            "the early morning. Support tall plants with a wooden stake.</p>"
        ),
        "summary_ar": "خطوات عملية لزراعة الطماطم في المنزل.",
    },
    "bike": {
        "title_ar": "صيانة الدراجة الهوائية بنفسك",
        "title_en": "DIY Bicycle Maintenance",
        "content_ar": (
            "<p>نظّف سلسلة الدراجة كل بضعة أسابيع بقطعة قماش، ثم ضع عليها زيت تشحيم خاصاً "
            "بالسلاسل لتقليل الاحتكاك والصدأ.</p>"
            "<p>افحص ضغط الإطارات قبل كل رحلة باستخدام منفاخ بمقياس، فالضغط المنخفض يزيد خطر "
            "ثقب الإطار ويجعل القيادة أصعب.</p>"
            "<p>تأكد من أن الفرامل تعمل جيداً، واستبدل وسائد الفرامل إذا أصبحت رقيقة أو سمعت "
            "صوت احتكاك معدني.</p>"
        ),
        "content_en": None,  # بلا نسخة إنجليزية: لاختبار lang_fallback
        "summary_ar": "دليل مبسط لصيانة الدراجة في البيت.",
    },
    "time": {
        "title_ar": "تنظيم الوقت للطلاب أثناء الاختبارات",
        "title_en": "Time Management for Students During Exams",
        "content_ar": (
            "<p>قسّم وقت المذاكرة إلى فترات قصيرة مدتها خمس وعشرون دقيقة تتخللها استراحة قصيرة، "
            "فهذا يساعد على التركيز ويقلل الإرهاق.</p>"
            "<p>اكتب جدولاً أسبوعياً يحدد المواد الدراسية لكل يوم، وابدأ بالمواد الأصعب في "
            "الأوقات التي تكون فيها أكثر نشاطاً.</p>"
            "<p>احرص على النوم الكافي ليلة الاختبار، فالسهر الطويل يضعف الذاكرة والانتباه.</p>"
        ),
        "content_en": (
            "<p>Split your study time into short twenty-five minute sessions with short breaks "
            "in between. Write a weekly schedule and get enough sleep before the exam.</p>"
        ),
        "summary_ar": "نصائح لتنظيم وقت المذاكرة.",
    },
}

# أسئلة مطابقة: (مفتاح المادة الصحيحة، السؤال، لغة المادة المطلوبة)
MATCH_QUESTIONS = [
    ("garden", "كم ساعة شمس تحتاج نبتة الطماطم؟", "ar"),
    ("garden", "كيف أسقي الطماطم في البيت؟", "ar"),
    ("bike", "كيف أنظف سلسلة الدراجة وأزيتها؟", "ar"),
    ("bike", "متى أغير وسائد الفرامل في الدراجة؟", "ar"),
    ("time", "كيف أنظم وقت المذاكرة قبل الامتحان؟", "ar"),
    ("time", "How should I organize my study time before exams?", "en"),
    ("garden", "How much sunlight do tomato plants need?", "en"),
]

# أسئلة بعيدة عن كل المواد (يجب أن تكون تحت العتبة)
FAR_QUESTIONS = [
    ("ما هي عاصمة أستراليا؟", "ar"),
    ("كم تبلغ المسافة بين الأرض والقمر؟", "ar"),
    ("ما أفضل طريقة لتعلم العزف على البيانو؟", "ar"),
    ("What is the capital of Australia?", "en"),
]

CENTERS = [
    {"name": f"مركز تجريبي للاختبار {TAG}", "country": "—", "url": "https://example.com", "contact": "test@example.com"},
]


def create_fixtures(headers: dict, with_centers: bool = False) -> dict:
    """ينشئ قسماً + 3 مواد (منشورة ومفهرسة) [+ مركز إحالة]. يرجع المعرّفات للتنظيف."""
    created: dict = {"section": None, "posts": {}, "centers": []}
    r = client.post("/api/admin/sections", headers=headers, json={
        "name_ar": "قسم تجريبي للاختبار", "name_en": f"Test Section {TAG}",
        "category": "methodology", "sort_order": 999,
    })
    if not step("إنشاء قسم تجريبي", r.status_code == 201, detail(r) if r.status_code != 201 else ""):
        return created
    created["section"] = r.json()["id"]
    for key, p in POSTS.items():
        r = client.post("/api/admin/posts", headers=headers, json={
            **p, "section_id": created["section"], "title_en": p["title_en"],
            "slug": f"test-{key}-{TAG}", "source_name": "بيانات اختبار",
            "external_ref": "https://example.com/test", "tags": ["اختبار"],
        })
        if not step(f"إنشاء منشور «{key}»", r.status_code == 201, detail(r) if r.status_code != 201 else ""):
            continue
        created["posts"][key] = r.json()["id"]
    if with_centers:
        for c in CENTERS:
            r = client.post("/api/admin/referral-centers", headers=headers, json=c)
            if step("إنشاء مركز إحالة تجريبي", r.status_code == 201, detail(r) if r.status_code != 201 else ""):
                created["centers"].append(r.json()["id"])
    return created


def publish_all(headers: dict, created: dict) -> None:
    for key, pid in created["posts"].items():
        r = client.post(f"/api/admin/posts/{pid}/publish", headers=headers)
        b = r.json() if r.is_success else {}
        step(f"نشر وفهرسة «{key}»",
             r.status_code == 200 and b.get("indexed") and b.get("chunks", 0) > 0 and b.get("indexed_at"),
             f"chunks={b.get('chunks')}, warning={b.get('index_warning')}" if r.is_success else detail(r))


def cleanup(headers: dict, created: dict) -> None:
    for pid in created["posts"].values():
        r = client.delete(f"/api/admin/posts/{pid}", headers=headers)
        step(f"حذف المنشور التجريبي {pid}", r.status_code in (200, 404), detail(r))
    for cid in created["centers"]:
        r = client.delete(f"/api/admin/referral-centers/{cid}", headers=headers)
        step(f"حذف المركز التجريبي {cid}", r.status_code in (200, 404), detail(r))
    if created["section"]:
        r = client.delete(f"/api/admin/sections/{created['section']}", headers=headers)
        step("حذف القسم التجريبي", r.status_code in (200, 404), detail(r))


def summary() -> int:
    passed = sum(results)
    print(f"\n{'🎉' if all(results) else '⚠️ '} {passed}/{len(results)} خطوة نجحت")
    return 0 if all(results) else 1
