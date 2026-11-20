"""اختبار الإيجنت كاملاً (Supabase + Gemini الحقيقيين) ثم حذف كل البيانات التجريبية.

- رد match: content == نص المنشور في القاعدة حرفياً (ar، و en مع lang_fallback).
- سؤال بعيد: fallback + referrals.  - chat_logs سُجّل فيها الأسئلة، و feedback يعمل.
- /ai/test و /ai/settings و /ai/logs و /ai/unanswered و /dashboard/stats و referral-centers.
- حد الطلبات 20/دقيقة.

التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe agent_test.py
"""
import sys
import uuid

from fastapi import HTTPException
from starlette.requests import Request

from app.agent.guidance import MAX_WORDS
from app.db import get_supabase
from app.routers.chat import RATE_LIMIT, check_rate_limit, reset_rate_limit
from testkit import TAG, cleanup, client, create_fixtures, detail, login, publish_all, step, summary


def db_post(pid: int) -> dict:
    return get_supabase().table("posts").select("*").eq("id", pid).limit(1).execute().data[0]


def main() -> int:
    headers = login()
    step("تسجيل الدخول", True)
    session = f"test-{uuid.uuid4().hex[:12]}"
    log_ids: list[int] = []
    created = create_fixtures(headers, with_centers=True)
    original_settings = client.get("/api/admin/ai/settings", headers=headers).json()
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
            p = b["post"]
            dbp = db_post(ids["garden"])
            step("المادة الصحيحة", p["id"] == ids["garden"], p["title"])
            step("content == content_ar في القاعدة (حرفياً)", p["content"] == dbp["content_ar"])
            step("title/source/external_ref من القاعدة", p["title"] == dbp["title_ar"]
                 and p["source_name"] == dbp["source_name"] and p["external_ref"] == dbp["external_ref"])
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
        ok = b.get("type") == "match" and b["post"]["id"] == ids["time"]
        step("سؤال إنجليزي → match بالمادة الصحيحة", ok, detail(r) if not r.is_success else b.get("type"))
        if ok:
            dbp = db_post(ids["time"])
            step("content == content_en حرفياً، lang_fallback=false",
                 b["post"]["content"] == dbp["content_en"] and b["post"]["lang_fallback"] is False)
            print(f"   التوجيه: {b['guidance']}")

        # ---------- en لمادة بلا نسخة إنجليزية ----------
        r = client.post("/api/chat", json={"message": "How do I clean and oil my bicycle chain?",
                                           "lang": "en", "session_id": session})
        b = r.json() if r.is_success else {}
        if b.get("log_id"):
            log_ids.append(b["log_id"])
        ok = b.get("type") == "match" and b["post"]["id"] == ids["bike"]
        step("lang=en لمادة عربية فقط → match", ok,
             detail(r) if not r.is_success else f"{b.get('type')} top={(b.get('closest') or {}).get('similarity')}")
        if ok:
            dbp = db_post(ids["bike"])
            step("ترجع العربية حرفياً مع lang_fallback=true",
                 b["post"]["content"] == dbp["content_ar"] and b["post"]["lang_fallback"] is True)

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
            step("لا يوجد أي نص مادة في رد fallback", "post" not in b and "content" not in str(b.get("closest")))

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
        step("POST /api/admin/ai/test", r.status_code == 200 and b.get("decision") == "match"
             and b["preview"]["post"]["id"] == ids["bike"] and b.get("results") and "threshold" in b
             and b.get("classification", {}).get("lang") == "ar",
             f"category={b.get('classification', {}).get('category')}, top={b.get('top_score')}, "
             f"guidance_source={b.get('guidance_source')}" if r.is_success else detail(r))
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
        r = client.put("/api/admin/ai/settings", headers=headers, json={"top_k": original_settings["top_k"]})
        step("إرجاع top_k الأصلي", r.status_code == 200 and r.json()["top_k"] == original_settings["top_k"], detail(r))

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
        cleanup(headers, created)
    return summary()


if __name__ == "__main__":
    sys.exit(main())
