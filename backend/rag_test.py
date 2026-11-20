"""اختبار محرك RAG على قاعدة Supabase و Gemini الحقيقيين (يحذف كل ما ينشئه).

1. 3 مواد تجريبية مميزة -> نشر -> فهرسة تلقائية.
2. أسئلة مطابقة: المادة الصحيحة أولاً.  3. أسئلة بعيدة: درجاتها أقل.
4. تعديل محتوى منشور منشور -> إعادة فهرسة.  5. إرجاعه لمسودة -> يختفي من البحث.
6. اقتراح عتبة تشابه من الدرجات، وحفظها في ai_settings (--no-save لعدم الحفظ).

التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe rag_test.py
"""
import sys

from app.config import CHAT_MODELS  # noqa: F401 — يتأكد من تحميل الإعدادات
from app.db import get_supabase
from app.rag.search import search
from testkit import (
    FAR_QUESTIONS, MATCH_QUESTIONS, cleanup, client, create_fixtures, detail, login,
    publish_all, step, summary,
)


def suggest_threshold(match_scores: list[float], far_scores: list[float]) -> float | None:
    """منتصف الفجوة بين أضعف تطابق صحيح وأقوى سؤال بعيد (مقرّب لأقرب 0.01)."""
    if not match_scores or not far_scores:
        return None
    lo, hi = max(far_scores), min(match_scores)
    if hi <= lo:
        return None
    return round((lo + hi) / 2, 2)


def main() -> int:
    save = "--no-save" not in sys.argv
    headers = login()
    step("تسجيل الدخول", True)
    created = create_fixtures(headers)
    threshold = None
    try:
        if len(created["posts"]) != 3:
            return summary()
        publish_all(headers, created)
        ids = created["posts"]
        key_of = {v: k for k, v in ids.items()}

        chunks = get_supabase().table("post_chunks").select("post_id, lang, chunk_text").in_(
            "post_id", list(ids.values())).execute().data
        langs = {(key_of[c["post_id"]], c["lang"]) for c in chunks}
        step("المقاطع بلغتها: garden(ar,en) bike(ar فقط) time(ar,en)",
             langs == {("garden", "ar"), ("garden", "en"), ("bike", "ar"), ("time", "ar"), ("time", "en")},
             str(sorted(langs)))
        step("كل مقطع يبدأ بالعنوان", all(c["chunk_text"].startswith(("العنوان: ", "Title: ")) for c in chunks))
        step("لا وسوم HTML في المقاطع", not any("<p>" in c["chunk_text"] for c in chunks))

        # ---------- أسئلة مطابقة ----------
        print("\n— الأسئلة المطابقة —")
        match_scores: list[float] = []
        for key, q, lang in MATCH_QUESTIONS:
            res = [r for r in search(q, lang, 5) if r["post_id"] in key_of]
            top = res[0] if res else None
            scores = ", ".join(f"{key_of[r['post_id']]}={r['similarity']:.4f}" for r in res)
            ok = top is not None and top["post_id"] == ids[key]
            if top:
                match_scores.append(top["similarity"])
            step(f"[{lang}] {q} → {key} أولاً", ok, scores)

        # ---------- أسئلة بعيدة ----------
        print("\n— الأسئلة البعيدة —")
        far_scores: list[float] = []
        for q, lang in FAR_QUESTIONS:
            res = search(q, lang, 5)
            best = res[0]["similarity"] if res else 0.0
            far_scores.append(best)
            print(f"   [{lang}] {q} → أعلى درجة {best:.4f}"
                  + (f" ({res[0]['title']})" if res else ""), flush=True)

        threshold = suggest_threshold(match_scores, far_scores)
        print(f"\n   أضعف تطابق صحيح: {min(match_scores):.4f} | أقوى سؤال بعيد: {max(far_scores):.4f}")
        step("فجوة واضحة بين التطابق والبعيد", threshold is not None,
             f"العتبة المقترحة = {threshold}" if threshold else "لا توجد فجوة")
        if threshold is not None:
            step("كل الأسئلة البعيدة أقل من العتبة", all(s < threshold for s in far_scores))
            step("كل التطابقات الصحيحة ≥ العتبة", all(s >= threshold for s in match_scores))

        # ---------- إعادة الفهرسة عند تعديل المحتوى ----------
        print()
        pid = ids["garden"]
        before = client.get(f"/api/admin/posts/{pid}", headers=headers).json()["indexed_at"]
        new_content = before and (client.get(f"/api/admin/posts/{pid}", headers=headers).json()["content_ar"]
                                  + "<p>أضف طبقة من القش حول النبات للحفاظ على رطوبة التربة.</p>")
        r = client.put(f"/api/admin/posts/{pid}", headers=headers, json={"content_ar": new_content})
        b = r.json() if r.is_success else {}
        step("PUT محتوى منشور منشور → إعادة فهرسة", r.status_code == 200 and b.get("indexed")
             and b.get("indexed_at") != before, f"chunks={b.get('chunks')}" if r.is_success else detail(r))
        txt = get_supabase().table("post_chunks").select("chunk_text").eq("post_id", pid).eq("lang", "ar").execute().data
        step("المقاطع الجديدة تحتوي النص المضاف", any("طبقة من القش" in c["chunk_text"] for c in txt))

        r = client.put(f"/api/admin/posts/{pid}", headers=headers, json={"tags": ["اختبار", "حديقة"]})
        step("PUT الوسوم فقط → لا إعادة فهرسة", r.status_code == 200 and not r.json().get("indexed"), detail(r))

        r = client.post(f"/api/admin/posts/{pid}/reindex", headers=headers)
        step("POST /api/admin/posts/{id}/reindex", r.status_code == 200 and r.json().get("indexed"), detail(r))

        r = client.get("/api/admin/ai/index-status", headers=headers)
        st = r.json() if r.is_success else {}
        mine = [i for i in st.get("items", []) if i["post_id"] in key_of]
        step("GET /api/admin/ai/index-status", r.status_code == 200 and len(mine) == 3
             and all(i["state"] == "indexed" for i in mine),
             f"published={st.get('published')}, indexed={st.get('indexed')}, stale={st.get('stale')}, "
             f"chunks={st.get('total_chunks')}" if r.is_success else detail(r))

        # ---------- إرجاع منشور لمسودة ----------
        pid = ids["bike"]
        r = client.put(f"/api/admin/posts/{pid}", headers=headers, json={"status": "draft"})
        step("إرجاع «bike» لمسودة", r.status_code == 200 and r.json()["indexed_at"] is None, detail(r))
        n = get_supabase().table("post_chunks").select("id", count="exact").eq("post_id", pid).execute().count
        step("حُذفت مقاطعه", n == 0, f"chunks={n}")
        res = search("كيف أنظف سلسلة الدراجة وأزيتها؟", "ar", 5)
        step("المسودة لا تظهر في البحث", all(x["post_id"] != pid for x in res),
             ", ".join(f"{x['title']}={x['similarity']:.4f}" for x in res))

        r = client.post(f"/api/admin/posts/{pid}/reindex", headers=headers)
        step("إعادة فهرسة مسودة تُرفض", r.status_code == 400, detail(r))

        r = client.post("/api/admin/ai/reindex", headers=headers)
        b = r.json() if r.is_success else {}
        step("POST /api/admin/ai/reindex (المنشورة فقط)", r.status_code == 200 and not b.get("failed"),
             str(b) if r.is_success else detail(r))
        n = get_supabase().table("post_chunks").select("id", count="exact").eq("post_id", pid).execute().count
        step("المسودة بقيت غير مفهرسة بعد إعادة البناء", n == 0)

        # ---------- حفظ العتبة ----------
        if threshold is not None and save:
            r = client.put("/api/admin/ai/settings", headers=headers, json={"similarity_threshold": threshold})
            step(f"حفظ similarity_threshold={threshold} في ai_settings",
                 r.status_code == 200 and r.json()["similarity_threshold"] == threshold,
                 f"version={r.json().get('version')}" if r.is_success else detail(r))
    finally:
        print()
        cleanup(headers, created)
    return summary()


if __name__ == "__main__":
    sys.exit(main())
