r"""اختبار استيراد المحتوى POST /api/admin/posts/import (JSON و CSV، المعاينة والحفظ). يحذف كل ما ينشئه.

التشغيل (من مجلد backend):  .venv\Scripts\python.exe import_test.py
"""
import json
import sys

from app.config import BACKEND_DIR
from app.db import get_supabase
from app.rag.chunking import clean_html
from testkit import TAG, client, detail, login, step, summary

DOCS = BACKEND_DIR.parent / "docs"
SEC = f"test-import-{TAG}"


def imp(headers: dict, fmt: str, content: str, dry_run: bool = True, status: str = "draft"):
    return client.post("/api/admin/posts/import", headers=headers,
                       json={"format": fmt, "content": content, "dry_run": dry_run, "status": status})


def errs(row: dict) -> str:
    return " | ".join(row["errors"])


def main() -> int:
    headers = login()
    step("تسجيل الدخول", True)
    sb = get_supabase()
    section_id = existing_id = None
    created_ids: list[int] = []
    try:
        r = client.post("/api/admin/sections", headers=headers, json={
            "name_ar": "قسم استيراد تجريبي", "slug": SEC, "category": "methodology", "sort_order": 999})
        if not step("إنشاء قسم تجريبي", r.status_code == 201, detail(r)):
            return summary()
        section_id = r.json()["id"]
        r = client.post("/api/admin/posts", headers=headers, json={
            "section_id": section_id, "slug": f"imp-existing-{TAG}", "title_ar": "مادة موجودة",
            "content_ar": "<p>نص تجريبي.</p>"})
        step("إنشاء منشور موجود (لاختبار التكرار)", r.status_code == 201, detail(r))
        existing_id = r.json().get("id")

        rows = [
            {"id": f"imp-ok-{TAG}", "category": "methodology", "section_slug": SEC, "topic": "موضوع تجريبي",
             "title_ar": "مادة تجريبية أولى", "title_en": "Test One",
             "content_ar": "الفقرة الأولى من نص تجريبي.\n\nالفقرة الثانية < و > & رموز.",
             "content_en": "<p>English test text.</p>", "tags": ["اختبار", "استيراد"],
             "external_ref": "https://example.com/a", "summary_ar": "ملخص", "source_name": "بيانات اختبار",
             "content_type": "leaflet", "extra_col": "x"},
            {"id": f"imp-default-{TAG}", "category": "methodology", "title_ar": "بلا قسم محدد",
             "content_ar": "<p>نص.</p>", "tags": "أ|ب"},
            {"id": f"imp-missing-{TAG}", "category": "methodology", "section_slug": SEC, "content_ar": "نص"},
            {"id": f"imp-nosec-{TAG}", "category": "methodology", "section_slug": f"no-such-{TAG}",
             "title_ar": "قسم غير موجود", "content_ar": "نص"},
            {"id": f"imp-existing-{TAG}", "category": "methodology", "section_slug": SEC,
             "title_ar": "مكرر في القاعدة", "content_ar": "نص"},
            {"id": f"imp-ok-{TAG}", "category": "methodology", "section_slug": SEC,
             "title_ar": "مكرر في الملف", "content_ar": "نص"},
            {"category": "other", "title_ar": "مسار خاطئ", "content_ar": "نص", "content_type": "video",
             "external_ref": "example.com"},
            {"category": "shubuhat", "section_slug": SEC, "title_ar": "مسار لا يطابق القسم", "content_ar": "نص"},
        ]
        before = sb.table("posts").select("id", count="exact").limit(1).execute().count

        # ---------- JSON: معاينة ----------
        r = imp(headers, "json", json.dumps(rows, ensure_ascii=False))
        b = r.json() if r.is_success else {}
        step("JSON dry_run → 200", r.status_code == 200, detail(r))
        res = b.get("rows", [])
        step("الإجمالي 8: صالح 2، غير صالح 6", (b.get("total"), b.get("valid"), b.get("invalid")) == (8, 2, 6),
             f"{b.get('total')}/{b.get('valid')}/{b.get('invalid')}")
        if len(res) == 8:
            ok, dflt, miss, nosec, dupdb, dupfile, bad, mism = res
            step("صف صالح: القسم والنوع والوسوم", not ok["errors"] and ok["section_id"] == section_id
                 and ok["content_type"] == "leaflet" and ok["tags"] == ["اختبار", "استيراد"] and ok["has_en"],
                 errs(ok))
            step("عمود غير معروف = تحذير لا خطأ", any("extra_col" in w for w in ok["warnings"]), str(ok["warnings"]))
            step("بلا section_slug → أول قسم في المسار + تحذير", not dflt["errors"] and dflt["section_id"]
                 and dflt["tags"] == ["أ", "ب"] and any("section_slug" in w for w in dflt["warnings"]), errs(dflt))
            step("حقل ناقص: العنوان", "حقل ناقص: العنوان بالعربية" in errs(miss), errs(miss))
            step("قسم غير موجود", "غير موجود" in errs(nosec), errs(nosec))
            step("slug مكرر في القاعدة", "مستخدم لمادة موجودة" in errs(dupdb), errs(dupdb))
            step("slug مكرر في الملف", "الصف 1" in errs(dupfile), errs(dupfile))
            step("مسار ونوع ورابط غير صالحة", all(k in errs(bad) for k in ("مسار غير معروف", "نوع محتوى", "http")),
                 errs(bad))
            step("القسم لا يطابق المسار", "مساراً آخر" in errs(mism), errs(mism))
        after = sb.table("posts").select("id", count="exact").limit(1).execute().count
        step("المعاينة لا تنشئ شيئاً", after == before, f"{before} → {after}")

        # ---------- CSV: القالب ----------
        tpl = (DOCS / "content-template.csv").read_text(encoding="utf-8-sig").replace("example-section", SEC)
        tpl = tpl.replace("example-001", f"imp-csv-{TAG}")
        r = imp(headers, "csv", "﻿" + tpl)
        b = r.json() if r.is_success else {}
        row = (b.get("rows") or [{}])[0]
        step("قالب CSV صالح في المعاينة", r.status_code == 200 and b.get("valid") == 1,
             errs(row) if row.get("errors") else detail(r))
        step("CSV: الوسوم مفصولة بـ |", row.get("tags") == ["وسم أول", "وسم ثان"], str(row.get("tags")))
        jtpl = json.loads((DOCS / "content-template.json").read_text(encoding="utf-8"))
        jtpl[0].update(section_slug=SEC, id=f"imp-jtpl-{TAG}")
        r = imp(headers, "json", json.dumps(jtpl, ensure_ascii=False))
        step("قالب JSON صالح في المعاينة", r.status_code == 200 and r.json().get("valid") == 1, detail(r))

        r = imp(headers, "csv", "title_ar,content_ar\nأ,ب\n")
        step("CSV بلا عمود category → 400 بالعربية", r.status_code == 400 and "category" in r.json()["detail"], detail(r))
        r = imp(headers, "json", "[{bad json")
        step("JSON تالف → 400 بالعربية", r.status_code == 400 and "JSON" in r.json()["detail"], detail(r))
        r = imp(headers, "json", json.dumps(rows[:1]), status="published")
        step("لا نشر تلقائي: status=published مرفوض (422)", r.status_code == 422, detail(r))
        r = client.post("/api/admin/posts/import", json={"format": "json", "content": "[]"})
        step("بلا JWT → 401", r.status_code == 401, detail(r))

        # ---------- الحفظ (قيد المراجعة) ----------
        r = imp(headers, "json", json.dumps(rows, ensure_ascii=False), dry_run=False, status="review")
        b = r.json() if r.is_success else {}
        created_ids = [x["created_id"] for x in b.get("rows", []) if x.get("created_id")]
        step("الحفظ: يُنشأ الصالح فقط (2)", r.status_code == 200 and b.get("created") == 2 and len(created_ids) == 2,
             detail(r) if not r.is_success else f"created={b.get('created')}")
        posts = sb.table("posts").select("*").in_("id", created_ids or [0]).order("id").execute().data
        step("الحالة review، غير منشورة وغير مفهرسة",
             len(posts) == 2 and all(p["status"] == "review" and not p["published_at"] and not p["indexed_at"]
                                     for p in posts))
        if posts:
            p = posts[0]
            step("slug من id", p["slug"] == f"imp-ok-{TAG}", p["slug"])
            step("النص العادي صار فقرات <p> مع تهريب الرموز",
                 p["content_ar"] == "<p>الفقرة الأولى من نص تجريبي.</p><p>الفقرة الثانية &lt; و &gt; &amp; رموز.</p>",
                 p["content_ar"])
            step("الحروف لم تتغير (بعد إزالة الوسوم)",
                 clean_html(p["content_ar"]) == "الفقرة الأولى من نص تجريبي.\n\nالفقرة الثانية < و > & رموز.")
            step("HTML يبقى كما هو حرفياً", p["content_en"] == "<p>English test text.</p>")
            step("created_by = المستخدم الحالي", p["created_by"] is not None)
            n = sb.table("post_chunks").select("id", count="exact").in_("post_id", created_ids).execute().count
            step("لا مقاطع مفهرسة للمستورد", n == 0, f"chunks={n}")
        r = imp(headers, "json", json.dumps(rows[:1], ensure_ascii=False))
        step("إعادة الاستيراد نفسه → slug مكرر", r.status_code == 200 and r.json()["valid"] == 0, detail(r))
    finally:
        print()
        for pid in created_ids + ([existing_id] if existing_id else []):
            r = client.delete(f"/api/admin/posts/{pid}", headers=headers)
            step(f"حذف المنشور التجريبي {pid}", r.status_code in (200, 404), detail(r))
        if section_id:
            r = client.delete(f"/api/admin/sections/{section_id}", headers=headers)
            step("حذف القسم التجريبي", r.status_code in (200, 404), detail(r))
    return summary()


if __name__ == "__main__":
    sys.exit(main())
