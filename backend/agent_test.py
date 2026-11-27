"""اختبار الإيجنت كاملاً (Supabase + Gemini الحقيقيين) ثم حذف كل البيانات التجريبية.

- رد match: items (1..3 مصادر) باقتباس حرفي من نص المنشور في القاعدة + رابط الموقع (ar، و en مع lang_fallback).
- سؤال بعيد: fallback + referrals.  - chat_logs سُجّل فيها الأسئلة، و feedback يعمل.
- /ai/test و /ai/settings و /ai/logs و /ai/unanswered و /dashboard/stats و referral-centers.
- حد الطلبات 20/دقيقة.

التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe agent_test.py
"""
import sys
import uuid

from fastapi import HTTPException
from starlette.requests import Request

from app.agent.extractor import MAX_WORDS as EXTRACT_MAX_WORDS, extract_excerpts
from app.agent.guidance import MAX_WORDS
from app.db import get_supabase
from app.rag.chunking import clean_html
from app.routers.chat import RATE_LIMIT, check_rate_limit, reset_rate_limit
from testkit import TAG, cleanup, client, create_fixtures, detail, login, publish_all, step, summary


def db_post(pid: int) -> dict:
    return get_supabase().table("posts").select("*").eq("id", pid).limit(1).execute().data[0]


def is_verbatim(excerpt_html: str, source_html: str) -> bool:
    """كل فقرة في المقتطف موجودة حرفياً داخل النص المنظَّف للمادة."""
    src = " ".join(clean_html(source_html).split())
    parts = [p.strip() for p in clean_html(excerpt_html).splitlines() if p.strip()]
    return bool(parts) and all(p in src for p in parts)


def main() -> int:
    headers = login()
    step("تسجيل الدخول", True)
    session = f"test-{uuid.uuid4().hex[:12]}"
    log_ids: list[int] = []
    created = create_fixtures(headers, with_centers=True)
    original_settings = client.get("/api/admin/ai/settings", headers=headers).json()
    hist_before = get_supabase().table("ai_settings_history").select("id").order("id", desc=True).limit(1).execute().data
    hist_max = hist_before[0]["id"] if hist_before else 0
    try:
        if len(created["posts"]) != 3:
            return summary()
        publish_all(headers, created)
        ids = created["posts"]
        threshold = original_settings["similarity_threshold"]
        print(f"   العتبة الحالية: {threshold}\n")

        # ---------- match بالعربية ----------
        q = "كم ساعة شمس تحتاج نبتة الطماطم؟"
        r = client.post("/api/chat", json={"message": q, "lang": "ar", "session_id": session})
        b = r.json() if r.is_success else {}
        if b.get("log_id"):
            log_ids.append(b["log_id"])
        step("سؤال مطابق → type=match", b.get("type") == "match", detail(r) if not r.is_success else b.get("type"))
        if b.get("type") == "match":
            items = b.get("items") or []
            p = items[0] if items else {}
            dbp = db_post(ids["garden"])
            step("المادة الصحيحة ضمن items (1..3)", 1 <= len(items) <= 3 and p.get("id") == ids["garden"], p.get("title", ""))
            step("الاقتباس حرفي من content_ar مع رابط الموقع",
                 is_verbatim(p.get("content", ""), dbp["content_ar"]) and p.get("url") == f"/posts/{dbp['slug']}")
            step("title/source/external_ref من القاعدة", p.get("title") == dbp["title_ar"]
                 and p.get("source_name") == dbp["source_name"] and p.get("external_ref") == dbp["external_ref"])
            words = len(b["guidance"].split())
            step(f"جملة التوجيه ≤ {MAX_WORDS} كلمة", 0 < words <= MAX_WORDS, f"({words}) {b['guidance']}")
            step("related و sources بالدرجات", isinstance(b.get("related"), list)
                 and all("similarity" in s for s in b.get("sources", [])), f"sources={len(b.get('sources', []))}")
            step("log_id موجود", isinstance(b.get("log_id"), int))

        # ---------- match بالإنجليزية (مادة لها نسخة en) ----------
        r = client.post("/api/chat", json={"message": "How should I organize my study time before exams?",
                                           "lang": "en", "session_id": session})
        b = r.json() if r.is_success else {}
        if b.get("log_id"):
            log_ids.append(b["log_id"])
        items = b.get("items") or []
        first = items[0] if items else {}
        ok = b.get("type") == "match" and first.get("id") == ids["time"]
        step("سؤال إنجليزي → match بالمادة الصحيحة", ok, detail(r) if not r.is_success else b.get("type"))
        if ok:
            dbp = db_post(ids["time"])
            step("اقتباس حرفي من content_en، lang_fallback=false",
                 is_verbatim(first["content"], dbp["content_en"])
                 and first["lang_fallback"] is False
                 and first["url"] == f"/posts/{dbp['slug']}?lang=en")
            print(f"   التوجيه: {b['guidance']}")

        # ---------- en لمادة بلا نسخة إنجليزية ----------
        r = client.post("/api/chat", json={"message": "How do I clean and oil my bicycle chain?",
                                           "lang": "en", "session_id": session})
        b = r.json() if r.is_success else {}
        if b.get("log_id"):
            log_ids.append(b["log_id"])
        items = b.get("items") or []
        first = items[0] if items else {}
        ok = b.get("type") == "match" and first.get("id") == ids["bike"]
        step("lang=en لمادة عربية فقط → match", ok,
             detail(r) if not r.is_success else f"{b.get('type')} top={(b.get('closest') or {}).get('similarity')}")
        if ok:
            dbp = db_post(ids["bike"])
            step("ترجع العربية حرفياً مع lang_fallback=true",
                 is_verbatim(first["content"], dbp["content_ar"]) and first["lang_fallback"] is True)

        # ---------- استخراج مقتطف حرفي من نص طويل متعدد المصادر (بدون قص منتصف الجملة) ----------
        long_p1 = "<p>" + " ".join(f"الفقرة الأولى جملة {i} تتحدث عن آداب الحوار بالحكمة والموعظة الحسنة." for i in range(1, 22)) + "</p>"
        long_p2 = "<p>" + " ".join(f"الفقرة الثانية جملة {i} تبين أهمية التدرج والرفق في الدعوة." for i in range(1, 22)) + "</p>"
        ex_map, ex_meta = extract_excerpts(
            "ما أهمية الرفق في الحوار؟",
            [
                {"id": 1001, "lang": "ar", "content": long_p1, "matched_chunks": ["آداب الحوار بالحكمة والموعظة الحسنة."]},
                {"id": 1002, "lang": "ar", "content": long_p2, "matched_chunks": ["أهمية التدرج والرفق في الدعوة."]},
            ],
        )
        ok_multi = (
            set(ex_map) == {1001, 1002}
            and all(ex_map[k]["is_excerpt"] and ex_map[k]["word_count"] <= EXTRACT_MAX_WORDS for k in (1001, 1002))
            and ex_map[1001]["text"] in clean_html(long_p1)
            and ex_map[1002]["text"] in clean_html(long_p2)
            and ex_map[1001]["text"].endswith(".") and ex_map[1002]["text"].endswith(".")
        )
        step("استخراج متعدد المصادر: مقتطفان حرفيان ≤ 100 كلمة دون قص الجمل", ok_multi,
             f"source={ex_meta.get('source')}, words={[ex_map[k]['word_count'] for k in (1001, 1002)]}")

        # ---------- fallback ----------
        far = f"ما هي عاصمة أستراليا؟ {TAG}"
        r = client.post("/api/chat", json={"message": far, "lang": "ar", "session_id": session})
        b = r.json() if r.is_success else {}
        if b.get("log_id"):
            log_ids.append(b["log_id"])
        step("سؤال بعيد → type=fallback", b.get("type") == "fallback", detail(r) if not r.is_success else b.get("type"))
        if b.get("type") == "fallback":
            step("الرسالة من ai_settings", b["message"] == original_settings["fallback_message_ar"])
            step("referrals تحتوي المركز التجريبي",
                 any(c["id"] in created["centers"] for c in b.get("referrals", [])), f"{len(b['referrals'])} مركز")
            step("closest (أقرب مادة) موجود ودرجته تحت العتبة",
                 b.get("closest") and b["closest"]["similarity"] < threshold, str(b.get("closest")))
            step("لا يوجد أي نص مادة في رد fallback", "items" not in b and "post" not in b and "content" not in str(b.get("closest")))

        # ---------- chat_logs ----------
        logs = get_supabase().table("chat_logs").select("*").eq("session_id", session).order("id").execute().data
        step("chat_logs سُجّل فيها كل الأسئلة", len(logs) == len(log_ids) == 4, f"{len(logs)} سجل")
        flags = [l["is_fallback"] for l in logs]
        step("is_fallback صحيح لكل سجل", flags == [False, False, False, True], str(flags))

        # ---------- feedback ----------
        r = client.post("/api/chat/feedback", json={"log_id": log_ids[0], "helpful": True})
        r2 = client.post("/api/chat/feedback", json={"log_id": log_ids[-1], "helpful": False})
        fb = {l["id"]: l["feedback"] for l in get_supabase().table("chat_logs").select("id, feedback")
              .in_("id", [log_ids[0], log_ids[-1]]).execute().data}
        step("feedback يعمل (مفيد=1، غير مفيد=-1)", r.status_code == 200 and r2.status_code == 200
             and fb == {log_ids[0]: 1, log_ids[-1]: -1}, str(fb))
        r = client.post("/api/chat/feedback", json={"log_id": 999999999, "helpful": True})
        step("feedback لسجل غير موجود → 404", r.status_code == 404, detail(r))

        # ---------- /ai/test ----------
        before = get_supabase().table("chat_logs").select("id", count="exact").eq("session_id", session).execute().count
        r = client.post("/api/admin/ai/test", headers=headers, json={"message": "متى أغير وسائد الفرامل في الدراجة؟", "lang": "ar"})
        b = r.json() if r.is_success else {}
        lab_items = (b.get("preview") or {}).get("items") or []
        step("POST /api/admin/ai/test", r.status_code == 200 and b.get("decision") == "match"
             and lab_items and lab_items[0]["id"] == ids["bike"] and b.get("results") and "threshold" in b
             and b.get("classification", {}).get("lang") == "ar",
             f"category={b.get('classification', {}).get('category')}, top={b.get('top_score')}, "
             f"guidance_source={b.get('guidance_source')}, extractor_source={b.get('extractor_source')}" if r.is_success else detail(r))
        r = client.post("/api/admin/ai/test", headers=headers, json={"message": far, "lang": "ar"})
        step("/ai/test لسؤال بعيد → decision=fallback", r.is_success and r.json().get("decision") == "fallback", detail(r))
        total_logs = get_supabase().table("chat_logs").select("id", count="exact").execute().count
        step("/ai/test لا يسجّل في chat_logs", before == 4, f"session logs={before}, total={total_logs}")
        r = client.post("/api/admin/ai/test", json={"message": "x", "lang": "ar"})
        step("/ai/test بدون JWT → 401", r.status_code == 401, detail(r))

        # ---------- /ai/settings ----------
        r = client.get("/api/admin/ai/settings", headers=headers)
        step("GET /api/admin/ai/settings", r.status_code == 200 and "guidance_prompt" in r.json(), detail(r))
        v0 = r.json()["version"]
        r = client.put("/api/admin/ai/settings", headers=headers, json={"top_k": 4})
        step("PUT /api/admin/ai/settings يزيد version", r.status_code == 200 and r.json()["version"] == v0 + 1
             and r.json()["top_k"] == 4, f"version {v0} → {r.json().get('version')}" if r.is_success else detail(r))
        r = client.put("/api/admin/ai/settings", headers=headers, json={"similarity_threshold": 1.5})
        step("عتبة خارج 0..1 تُرفض", r.status_code == 422, detail(r))
        r = client.get("/api/admin/ai/settings/history", headers=headers)
        hist = r.json() if r.is_success else []
        prev = hist[0] if hist else {}
        step("الحفظ ينسخ الإصدار السابق إلى ai_settings_history", r.status_code == 200
             and prev.get("version") == v0 and prev.get("top_k") == original_settings["top_k"]
             and prev.get("saved_at"), f"آخر سجل: version={prev.get('version')}" if r.is_success else detail(r))
        s1 = client.get("/api/admin/ai/settings", headers=headers).json()
        step("updated_at و updated_by يتحدثان", bool(s1.get("updated_at"))
             and s1.get("updated_at") != original_settings.get("updated_at") and bool(s1.get("updated_by_user")),
             f"updated_at={s1.get('updated_at')}")
        r = client.post(f"/api/admin/ai/settings/restore/{prev.get('id', 0)}", headers=headers)
        b = r.json() if r.is_success else {}
        step("استرجاع إصدار سابق (كإصدار جديد)", r.status_code == 200 and b.get("top_k") == original_settings["top_k"]
             and b.get("version") == v0 + 2 and b.get("restored_from_version") == v0,
             f"version={b.get('version')}" if r.is_success else detail(r))
        r = client.post("/api/admin/ai/settings/restore/999999999", headers=headers)
        step("استرجاع إصدار غير موجود → 404", r.status_code == 404, detail(r))
        r = client.put("/api/admin/ai/settings", headers=headers, json={})
        step("PUT بدون حقول → 400", r.status_code == 400, detail(r))

        # ---------- logs / unanswered / stats ----------
        r = client.get("/api/admin/ai/logs", headers=headers, params={"fallback": "true"})
        step("GET /api/admin/ai/logs?fallback=true", r.status_code == 200
             and all(i["is_fallback"] for i in r.json()["items"]) and r.json()["total"] >= 1,
             f"total={r.json().get('total')}" if r.is_success else detail(r))
        client.post("/api/chat", json={"message": far + "  ", "lang": "ar", "session_id": session})
        r = client.get("/api/admin/ai/unanswered", headers=headers)
        grp = next((g for g in r.json() if TAG in g["question"]), None) if r.is_success else None
        step("GET /api/admin/ai/unanswered يجمّع التكرار", grp is not None and grp["count"] == 2 and grp.get("closest"),
             str(grp) if grp else detail(r))
        r = client.get("/api/admin/dashboard/stats", headers=headers)
        s = r.json() if r.is_success else {}
        step("GET /api/admin/dashboard/stats", r.status_code == 200 and s.get("posts_by_status", {}).get("published", 0) >= 3
             and s.get("questions_today", 0) >= 5 and 0 <= s.get("fallback_rate_today", -1) <= 1,
             f"sections={s.get('sections')}, posts={s.get('posts_by_status')}, indexed={s.get('posts_indexed')}, "
             f"today={s.get('questions_today')}, fallback_rate={s.get('fallback_rate_today')}" if r.is_success else detail(r))

        # ---------- referral centers CRUD ----------
        cid = created["centers"][0]
        r = client.put(f"/api/admin/referral-centers/{cid}", headers=headers, json={"country": "تجريبي"})
        step("PUT referral-center", r.status_code == 200 and r.json()["country"] == "تجريبي", detail(r))
        r = client.get(f"/api/admin/referral-centers/{cid}", headers=headers)
        step("GET referral-center", r.status_code == 200, detail(r))

        # ---------- validation + rate limit ----------
        r = client.post("/api/chat", json={"message": "", "lang": "ar", "session_id": session})
        step("رسالة فارغة → 422", r.status_code == 422, detail(r))
        # نختبر العدّاد مباشرة (بعنوان IP وهمي) حتى لا نستهلك حصة Gemini بـ 21 طلباً
        reset_rate_limit()
        req = Request({"type": "http", "headers": [], "client": ("203.0.113.9", 1)})
        blocked = 0
        for _ in range(RATE_LIMIT + 1):
            try:
                check_rate_limit(req)
            except HTTPException as e:
                blocked += e.status_code == 429
        step(f"حد الطلبات: الطلب رقم {RATE_LIMIT + 1} في الدقيقة → 429", blocked == 1, f"blocked={blocked}")
        reset_rate_limit()
    finally:
        print()
        n = get_supabase().table("chat_logs").delete().eq("session_id", session).execute().data
        step("حذف سجلات المحادثة التجريبية", True, f"{len(n or [])} سجل")
        # الإعدادات رجعت لقيمها الأصلية؛ نحذف نسخ السجل التي أنشأها الاختبار فقط
        h = get_supabase().table("ai_settings_history").delete().gt("id", hist_max).execute().data
        step("حذف نسخ سجل الإعدادات التجريبية", True, f"{len(h or [])} نسخة")
        cleanup(headers, created)
    return summary()


if __name__ == "__main__":
    sys.exit(main())
