"""اختبار الأسئلة المقترحة: ai_settings.suggested_questions عبر PUT اللوحة + المسار العام.

يعمل على Supabase الحقيقي (بلا Gemini)، ويعيد القائمة الأصلية والإصدار ويحذف نسخ السجل التي ينشئها.
الأسئلة التجريبية محايدة تماماً (ليست محتوى شرعياً).
"""
from app.ai_config import settings_cache
from app.cache import invalidate_public, public_cache
from app.db import get_supabase
from app.models import SUGGESTED_MAX, SUGGESTED_MAX_CHARS, clean_suggested_questions
from testkit import TAG, client, detail, login, step, summary

PUBLIC = "/api/public/suggested-questions"
SETTINGS = "/api/admin/ai/settings"


def _public() -> list | None:
    r = client.get(PUBLIC)
    return r.json().get("questions") if r.status_code == 200 else None


def main() -> int:
    # ---- أدوات بحتة ----
    step("التنظيف: مسافات + فارغ + مكرر", clean_suggested_questions(["  أ  ب ", "", "أ ب", "A", "a"]) == ["أ ب", "A"])
    try:
        clean_suggested_questions([f"س{i}" for i in range(SUGGESTED_MAX + 1)])
        step("أكثر من الحد: خطأ", False)
    except ValueError:
        step("أكثر من الحد: خطأ", True)
    step("المكرر لا يُحسب في الحد", len(clean_suggested_questions(["س"] * 10)) == 1)

    headers = login()
    sb = get_supabase()
    original = client.get(SETTINGS, headers=headers).json()
    hist = sb.table("ai_settings_history").select("id").order("id", desc=True).limit(1).execute().data
    hist_max = hist[0]["id"] if hist else 0
    try:
        step("GET الإعدادات يتضمن suggested_questions (قائمة)",
             isinstance(original.get("suggested_questions"), list), str(original.get("suggested_questions")))

        qs = [f"كيف أسقي نبتة الطماطم؟ {TAG}", f"How often should I oil a bike chain? {TAG}"]
        before = _public()  # يملأ الكاش العام قبل الحفظ
        step("المسار العام يعمل بلا JWT", isinstance(before, list))
        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": [f"  {qs[0]} ", "", qs[0], qs[1]]})
        step("PUT: حفظ مع التنظيف (مسافات/فارغ/مكرر)",
             r.status_code == 200 and r.json().get("suggested_questions") == qs, detail(r))
        step("الحفظ يُبطل الكاش: المسار العام يرجع الجديد فوراً", _public() == qs, str(_public()))
        hits = public_cache.hits
        _public()
        step("المسار العام مخزن في الكاش (60 ث)", public_cache.hits == hits + 1)

        r = client.put(SETTINGS, headers=headers, json={"top_k": original["top_k"]})
        step("تعديل حقل آخر لا يمس الأسئلة", r.status_code == 200 and r.json().get("suggested_questions") == qs, detail(r))

        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": [f"س{i}" for i in range(SUGGESTED_MAX + 1)]})
        msg = (r.json().get("errors") or [{}])[0].get("message", "") if r.status_code == 422 else ""
        step(f"أكثر من {SUGGESTED_MAX} أسئلة: 422 برسالة عربية", r.status_code == 422 and str(SUGGESTED_MAX) in msg, msg)
        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": ["س" * (SUGGESTED_MAX_CHARS + 1)]})
        step(f"سؤال أطول من {SUGGESTED_MAX_CHARS} حرفاً: 422", r.status_code == 422, detail(r))
        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": ["س" * SUGGESTED_MAX_CHARS]})
        step(f"سؤال بطول {SUGGESTED_MAX_CHARS} بالضبط: مقبول", r.status_code == 200, detail(r))
        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": "ليست قائمة"})
        step("قيمة ليست قائمة: 422", r.status_code == 422)
        step("القيم المرفوضة لم تُحفظ", _public() == ["س" * SUGGESTED_MAX_CHARS])

        r = client.put(SETTINGS, headers=headers, json={"suggested_questions": []})
        step("PUT []: إفراغ القائمة", r.status_code == 200 and r.json().get("suggested_questions") == [], detail(r))
        step("المسار العام يرجع قائمة فارغة", _public() == [])

        r = client.put(SETTINGS, json={"suggested_questions": qs})
        step("PUT بلا JWT: 401", r.status_code == 401)
    finally:
        # إعادة القائمة والإصدار الأصليين مباشرة، وحذف نسخ السجل التجريبية فقط
        sb.table("ai_settings").update({
            "suggested_questions": original.get("suggested_questions") or [],
            "top_k": original["top_k"], "version": original["version"],
        }).eq("id", original["id"]).execute()
        h = sb.table("ai_settings_history").delete().gt("id", hist_max).execute().data
        invalidate_public()
        settings_cache.clear()
        step("استعادة الإعدادات الأصلية وحذف نسخ السجل التجريبية", True, f"{len(h or [])} نسخة")
    return summary()


if __name__ == "__main__":
    raise SystemExit(main())
