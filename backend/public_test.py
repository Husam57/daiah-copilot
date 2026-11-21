"""اختبار المسارات العامة للموقع (الخطوة 7) + تجاهل الأسئلة غير المجابة وفلتر الفترة.

على Supabase الحقيقي، ببيانات محايدة (ليست محتوى شرعياً) تُحذف في النهاية. لا يستهلك Gemini
إلا في فهرسة المواد عند النشر (لا أسئلة للمساعد).
التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe public_test.py
"""
import secrets
import time
from datetime import datetime, timedelta, timezone

from app.cache import public_cache
from app.db import get_supabase
from app.routers.public import excerpt, reading_minutes
from testkit import client, detail, login, step, summary

TAG = secrets.token_hex(3)
LONG_AR = "<p>" + " ".join(["كلمة"] * 450) + "</p>"  # 450 كلمة -> 3 دقائق


def _post(section_id: int, key: str, **kw) -> dict:
    base = {
        "section_id": section_id,
        "slug": f"pub-{key}-{TAG}",
        "title_ar": f"عنوان تجريبي {key} {TAG}",
        "content_ar": f"<p>نص تجريبي محايد عن {key}.</p>",
        "summary_ar": f"ملخص {key}",
        "source_name": "بيانات اختبار",
        "content_type": "article",
        "tags": [],
    }
    return {**base, **kw}


def main() -> int:
    headers = login()
    sb = get_supabase()
    created = {"sections": [], "posts": [], "logs": []}

    # ---- أدوات بحتة ----
    step("reading_minutes: 450 كلمة = 3 دقائق", reading_minutes(LONG_AR) == 3, str(reading_minutes(LONG_AR)))
    step("reading_minutes: نص قصير = دقيقة", reading_minutes("<p>كلمتان فقط</p>") == 1)
    step("reading_minutes: فارغ = 0", reading_minutes("") == 0 and reading_minutes(None) == 0)
    ex = excerpt("<p>" + "أ " * 300 + "</p>", 50)
    step("excerpt يقطع عند حد كلمة ويضيف …", ex.endswith("…") and len(ex) <= 51, ex[:60])

    try:
        # ---- البيانات: قسم رئيسي + فرعي (منهجية) + قسم شبهات + قسم موقوف ----
        def mk_section(name, category, parent=None, active=True, slug=None):
            r = client.post("/api/admin/sections", headers=headers, json={
                "name_ar": f"{name} {TAG}", "name_en": f"{name} EN {TAG}", "category": category,
                "parent_id": parent, "is_active": active, "sort_order": 900, "slug": slug,
                "description": f"وصف {name}",
            })
            ok = step(f"إنشاء قسم «{name}»", r.status_code == 201, detail(r) if r.status_code != 201 else "")
            if ok:
                created["sections"].append(r.json()["id"])
                return r.json()
            return None

        parent = mk_section("منهجية تجريبية", "methodology", slug=f"pub-meth-{TAG}")
        child = mk_section("فرعي تجريبي", "methodology", parent=parent["id"] if parent else None, slug=f"pub-child-{TAG}")
        shub = mk_section("شبهات تجريبية", "shubuhat", slug=f"pub-shub-{TAG}")
        hidden = mk_section("قسم موقوف", "intro_islam", active=False, slug=f"pub-hidden-{TAG}")
        if not (parent and child and shub and hidden):
            return summary()

        posts = {
            "a": _post(parent["id"], "a", topic=f"موضوع1-{TAG}", tags=[f"وسم{TAG}", "مشترك"], content_ar=LONG_AR,
                       title_en=f"Alpha {TAG}", content_en="<p>English neutral text alpha.</p>"),
            "b": _post(child["id"], "b", topic=f"موضوع1-{TAG}", tags=["مشترك"], content_type="booklet",
                       file_url="https://example.com/b.pdf"),
            "c": _post(shub["id"], "c", topic=f"موضوع2-{TAG}", content_type="shubha_response", summary_ar=None,
                       content_ar="<p>" + "نص طويل محايد " * 40 + "</p>"),
            "d": _post(parent["id"], "d", topic=f"موضوع1-{TAG}"),  # تبقى مسودة
            "e": _post(hidden["id"], "e"),  # منشورة لكن قسمها موقوف
        }
        ids = {}
        for k, p in posts.items():
            r = client.post("/api/admin/posts", headers=headers, json=p)
            if step(f"إنشاء مادة «{k}»", r.status_code == 201, detail(r) if r.status_code != 201 else ""):
                ids[k] = r.json()["id"]
                created["posts"].append(ids[k])
        for k in ("a", "b", "c", "e"):
            if k in ids:
                r = client.post(f"/api/admin/posts/{ids[k]}/publish", headers=headers)
                step(f"نشر «{k}»", r.status_code == 200, detail(r) if r.status_code != 200 else "")

        # ---- الأقسام والعدّادات ----
        r = client.get("/api/sections")
        secs = {s["slug"]: s for s in r.json()} if r.status_code == 200 else {}
        step("GET /api/sections: الموقوف غير ظاهر", f"pub-hidden-{TAG}" not in secs and f"pub-meth-{TAG}" in secs)
        step("عدد مواد القسم الرئيسي يشمل الفرعي (a + b = 2)", secs.get(f"pub-meth-{TAG}", {}).get("posts_count") == 2,
             str(secs.get(f"pub-meth-{TAG}", {}).get("posts_count")))
        step("عدد مواد القسم الفرعي = 1", secs.get(f"pub-child-{TAG}", {}).get("posts_count") == 1)
        r = client.get("/api/sections?category=shubuhat")
        step("GET /api/sections?category=shubuhat", r.status_code == 200 and all(s["category"] == "shubuhat" for s in r.json())
             and any(s["slug"] == f"pub-shub-{TAG}" for s in r.json()))

        r = client.get("/api/categories")
        cats = {c["category"]: c for c in r.json()} if r.status_code == 200 else {}
        step("GET /api/categories: 4 مسارات", set(cats) == {"methodology", "shubuhat", "intro_islam", "new_muslim"})
        step("عدد المسارات لا يشمل المسودة ولا القسم الموقوف", cats.get("methodology", {}).get("posts_count", 0) >= 2
             and cats.get("shubuhat", {}).get("posts_count", 0) >= 1)

        r = client.get(f"/api/topics?section=pub-meth-{TAG}")
        topics = {t["topic"]: t["posts_count"] for t in r.json()} if r.status_code == 200 else {}
        step("GET /api/topics?section=: العدد بدون المسودة", topics == {f"موضوع1-{TAG}": 2}, str(topics))

        # ---- قائمة المواد ----
        def lst(qs: str) -> dict:
            r = client.get(f"/api/posts?{qs}")
            return r.json() if r.status_code == 200 else {"items": [], "total": -1, "_err": detail(r)}

        res = lst(f"q={TAG}&page_size=50")
        slugs = {i["slug"] for i in res["items"]}
        step("البحث يرجع المنشور فقط (a, b, c)", slugs == {f"pub-{k}-{TAG}" for k in "abc"}, str(sorted(slugs)))
        step("المسودة والقسم الموقوف مستبعدان", f"pub-d-{TAG}" not in slugs and f"pub-e-{TAG}" not in slugs)
        res = lst(f"section=pub-meth-{TAG}")
        step("فلتر section يشمل الفرعي", {i["slug"] for i in res["items"]} == {f"pub-a-{TAG}", f"pub-b-{TAG}"})
        res = lst(f"section=pub-child-{TAG}")
        step("فلتر القسم الفرعي وحده", [i["slug"] for i in res["items"]] == [f"pub-b-{TAG}"])
        res = lst(f"q={TAG}&content_type=booklet")
        step("فلتر content_type", [i["slug"] for i in res["items"]] == [f"pub-b-{TAG}"])
        res = lst(f"q={TAG}&lang=en")
        step("فلتر lang=en (له نسخة إنجليزية)", [i["slug"] for i in res["items"]] == [f"pub-a-{TAG}"])
        res = lst(f"q={TAG}&category=shubuhat")
        step("فلتر category", [i["slug"] for i in res["items"]] == [f"pub-c-{TAG}"])
        res = lst(f"topic=موضوع1-{TAG}")
        step("فلتر topic", {i["slug"] for i in res["items"]} == {f"pub-a-{TAG}", f"pub-b-{TAG}"})
        res = lst(f"tag=وسم{TAG}")
        step("فلتر tag", [i["slug"] for i in res["items"]] == [f"pub-a-{TAG}"])
        res = lst(f"q=Alpha {TAG}")
        step("البحث في title_en", [i["slug"] for i in res["items"]] == [f"pub-a-{TAG}"])
        res = lst(f"q={TAG}&page_size=2&page=1")
        res2 = lst(f"q={TAG}&page_size=2&page=2")
        step("الترقيم: total=3، صفحتان", res["total"] == 3 and len(res["items"]) == 2 and len(res2["items"]) == 1)
        res = lst("q=a,b(c)*%")
        step("بحث برموز خاصة لا يكسر الاستعلام", res["total"] >= 0)

        res = lst(f"q={TAG}&page_size=50")
        cards = {i["slug"]: i for i in res["items"]}
        a, c = cards.get(f"pub-a-{TAG}", {}), cards.get(f"pub-c-{TAG}", {})
        step("بطاقة: reading_minutes محسوب (a = 3)", a.get("reading_minutes") == 3, str(a.get("reading_minutes")))
        step("بطاقة: has_en + reading_minutes_en", a.get("has_en") is True and a.get("reading_minutes_en") == 1)
        step("بطاقة: section مرفق", (a.get("section") or {}).get("slug") == f"pub-meth-{TAG}")
        step("بطاقة: excerpt من النص نفسه عند غياب الملخص", (c.get("excerpt") or "").startswith("نص طويل محايد"))
        step("بطاقة: لا يُرسل المحتوى الكامل", "content_ar" not in a)

        r = client.get("/api/posts/latest?limit=24")
        step("GET /api/posts/latest", r.status_code == 200 and any(p["slug"] == f"pub-a-{TAG}" for p in r.json()))

        # ---- المادة + ذات صلة ----
        r = client.get(f"/api/posts/pub-a-{TAG}")
        b = r.json() if r.status_code == 200 else {}
        step("GET /api/posts/{slug}: النص حرفياً + وقت القراءة",
             b.get("content_ar") == LONG_AR and b.get("reading_minutes") == 3, detail(r) if r.status_code != 200 else "")
        me = client.get("/api/auth/me", headers=headers).json()
        step("reviewed_by_name = اسم من نشرها (بلا بريد)",
             b.get("reviewed_by_name") == me.get("name") and me.get("email", "@") not in str(b),
             str(b.get("reviewed_by_name")))
        r = client.get(f"/api/posts/pub-d-{TAG}")
        step("مسودة: 404", r.status_code == 404)
        r = client.get(f"/api/posts/pub-e-{TAG}")
        step("قسم موقوف: 404", r.status_code == 404)
        r = client.get(f"/api/posts/pub-a-{TAG}/related?limit=5")
        rel = [p["slug"] for p in r.json()] if r.status_code == 200 else []
        step("ذات صلة: b أولاً (وسم + موضوع مشترك)، ولا يشمل نفسه ولا المسودة",
             rel[:1] == [f"pub-b-{TAG}"] and f"pub-a-{TAG}" not in rel and f"pub-d-{TAG}" not in rel, str(rel))
        r = client.get(f"/api/sections/pub-meth-{TAG}/posts")
        step("GET /api/sections/{slug}/posts يشمل الفرعي", r.status_code == 200 and r.json()["total"] == 2)

        r = client.get("/api/referral-centers")
        step("GET /api/referral-centers (عام)", r.status_code == 200 and isinstance(r.json(), list))

        # ---- كاش المسارات العامة (60 ث) يُبطل عند التعديل والنشر ----
        public_cache.clear()
        client.get(f"/api/posts/pub-a-{TAG}")
        t0 = time.perf_counter()
        r1 = client.get(f"/api/posts/pub-a-{TAG}")
        warm_ms = (time.perf_counter() - t0) * 1000
        step("الطلب المتكرر من الكاش", r1.status_code == 200 and public_cache.stats()["hits"] >= 1,
             f"{warm_ms:.0f} ms")
        new_title = f"عنوان معدّل {TAG}"
        r = client.put(f"/api/admin/posts/{ids['a']}", headers=headers, json={"title_ar": new_title})
        r2 = client.get(f"/api/posts/pub-a-{TAG}")
        step("تعديل العنوان يظهر فوراً (الكاش أُبطل)", r.status_code == 200 and r2.json().get("title_ar") == new_title,
             r2.json().get("title_ar", ""))
        lst_before = {i["slug"] for i in client.get(f"/api/posts?page_size=50&section=pub-meth-{TAG}").json()["items"]}
        r = client.post(f"/api/admin/posts/{ids['d']}/publish", headers=headers)
        lst_after = {i["slug"] for i in client.get(f"/api/posts?page_size=50&section=pub-meth-{TAG}").json()["items"]}
        step("النشر يظهر فوراً في القائمة", f"pub-d-{TAG}" not in lst_before and f"pub-d-{TAG}" in lst_after,
             f"{len(lst_before)} → {len(lst_after)}")
        r = client.put(f"/api/admin/posts/{ids['d']}", headers=headers, json={"status": "draft"})
        step("إلغاء النشر يخفيها فوراً", client.get(f"/api/posts/pub-d-{TAG}").status_code == 404)

        # ---- الأسئلة غير المجابة: الفترة + التجاهل ----
        now = datetime.now(timezone.utc).isoformat()
        old = (datetime.now(timezone.utc) - timedelta(days=12)).isoformat()
        q_recent, q_old = f"سؤال تجريبي حديث {TAG}؟", f"سؤال تجريبي قديم {TAG}"
        rows = [
            {"session_id": f"test-{TAG}", "question": q_recent, "lang": "ar", "is_fallback": True, "created_at": now},
            {"session_id": f"test-{TAG}", "question": q_recent.replace("؟", ""), "lang": "ar", "is_fallback": True,
             "created_at": now},
            {"session_id": f"test-{TAG}", "question": q_old, "lang": "ar", "is_fallback": True, "created_at": old},
        ]
        ins = sb.table("chat_logs").insert(rows).execute().data
        created["logs"] = [x["id"] for x in ins]

        # ---- الرسم البياني: الأسئلة يومياً (آخر 7 أيام) ----
        r = client.get("/api/admin/dashboard/questions-daily?days=7&tz_offset=0", headers=headers)
        d = r.json() if r.status_code == 200 else {}
        items = d.get("items", [])
        today = items[-1] if items else {}
        step("questions-daily: 7 أيام متتالية تنتهي باليوم",
             len(items) == 7 and today.get("date") == datetime.now(timezone.utc).date().isoformat(), detail(r))
        step("اليوم يشمل السؤالين غير المجابين، والقديم (12 يوماً) خارج النطاق",
             today.get("fallback", 0) >= 2 and today.get("questions", 0) >= today.get("fallback", 0)
             and today.get("answered") == today.get("questions", 0) - today.get("fallback", 0), str(today))
        step("نسبة غير المجابة محسوبة", today.get("fallback_rate") is not None and 0 < today["fallback_rate"] <= 1)
        r = client.get("/api/admin/dashboard/questions-daily?days=7&tz_offset=180", headers=headers)
        step("questions-daily بفرق توقيت (الرياض)", r.status_code == 200 and len(r.json()["items"]) == 7)
        r = client.get("/api/admin/dashboard/questions-daily")
        step("questions-daily يتطلب JWT", r.status_code == 401)

        def unanswered(period: str) -> dict:
            r = client.get(f"/api/admin/ai/unanswered?limit=200&period={period}", headers=headers)
            # المفتاح = السؤال بلا علامة الاستفهام (السجلان المتطابقان يُجمعان تحت أحدهما)
            return {g["question"].rstrip("؟"): g for g in r.json()} if r.status_code == 200 else {}

        k_recent = q_recent.rstrip("؟")
        u7, u30, uall = unanswered("7d"), unanswered("30d"), unanswered("all")
        step("period=7d: الحديث فقط (مجمّعاً ×2)",
             k_recent in u7 and q_old not in u7 and u7[k_recent]["count"] == 2, str(list(u7)))
        step("period=30d و all: يشملان القديم", q_old in u30 and q_old in uall)
        r = client.get("/api/admin/ai/unanswered?period=bad", headers=headers)
        step("period غير صالح: 422", r.status_code == 422)
        before = client.get("/api/admin/dashboard/stats", headers=headers).json().get("unanswered_questions")
        r = client.post("/api/admin/ai/unanswered/ignore", headers=headers, json={"question": q_recent})
        step("تجاهل سؤال: يحدّث كل سجلاته المتطابقة (2)", r.status_code == 200 and r.json().get("ignored") == 2, detail(r))
        uall = unanswered("all")
        step("المتجاهل لا يظهر في القائمة", k_recent not in uall and q_old in uall)
        after = client.get("/api/admin/dashboard/stats", headers=headers).json().get("unanswered_questions")
        step("المتجاهل لا يُحسب في العدّاد", isinstance(before, int) and after == before - 1, f"{before} -> {after}")
        db = sb.table("chat_logs").select("id, ignored").in_("id", created["logs"]).execute().data
        step("ignored محفوظ في قاعدة البيانات", sum(1 for x in db if x["ignored"]) == 2)
        r = client.post("/api/admin/ai/unanswered/ignore", headers=headers, json={"question": q_recent})
        step("تجاهل سؤال غير موجود: 404", r.status_code == 404)
        r = client.post("/api/admin/ai/unanswered/ignore", json={"question": q_old})
        step("التجاهل يتطلب JWT", r.status_code == 401)
    finally:
        if created["logs"]:
            sb.table("chat_logs").delete().in_("id", created["logs"]).execute()
            step("حذف السجلات التجريبية", True)
        for pid in created["posts"]:
            r = client.delete(f"/api/admin/posts/{pid}", headers=headers)
            step(f"حذف المادة التجريبية {pid}", r.status_code in (200, 404), detail(r))
        for sid in reversed(created["sections"]):
            r = client.delete(f"/api/admin/sections/{sid}", headers=headers)
            step(f"حذف القسم التجريبي {sid}", r.status_code in (200, 404), detail(r))
    return summary()


if __name__ == "__main__":
    raise SystemExit(main())
