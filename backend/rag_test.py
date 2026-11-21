"""اختبار محرك RAG على قاعدة Supabase و Gemini الحقيقيين (يحذف كل ما ينشئه).

1. 3 مواد تجريبية مميزة -> نشر -> فهرسة تلقائية.
2. أسئلة مطابقة: المادة الصحيحة أولاً.  3. أسئلة بعيدة: درجاتها أقل.
4. تعديل محتوى منشور منشور -> إعادة فهرسة.  5. إرجاعه لمسودة -> يختفي من البحث.
6. اقتراح عتبة تشابه من الدرجات، وحفظها في ai_settings (--no-save لعدم الحفظ).
7. تقييم دقة البحث (مجموعة أكبر: 5 مواد متقاربة + 22 سؤالاً بصيغ مختلفة + 7 أسئلة بعيدة)
   لكل وضع بحث متاح (semantic / hybrid): Top-1، MRR، ودقة قرار match/fallback بالعتبة الحالية.

التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe rag_test.py
   --no-save    لا يحفظ العتبة المقترحة
   --eval-only  التقييم فقط (ينشئ المواد ويقيس ثم يحذفها)
   --json PATH  يحفظ أرقام التقييم في ملف JSON
"""
import inspect
import json
import sys
import time

from app.config import CHAT_MODELS  # noqa: F401 — يتأكد من تحميل الإعدادات
from app.db import get_supabase
from app.ai_config import get_active_settings
from app.rag import search as search_mod
from app.rag.search import search
from testkit import (
    EVAL_FAR_QUESTIONS, EVAL_QUESTIONS, FAR_QUESTIONS, MATCH_QUESTIONS, cleanup, client,
    create_eval_posts, create_fixtures, detail, login, publish_all, step, summary,
)


def _modes() -> list[str]:
    """أوضاع البحث التي يدعمها الكود الحالي (قبل البحث الهجين: semantic فقط)."""
    if "mode" in inspect.signature(search).parameters:
        return list(getattr(search_mod, "SEARCH_MODES", ("semantic",)))
    return ["semantic"]


def _run(q: str, lang: str, mode: str) -> list[dict]:
    if "mode" in inspect.signature(search).parameters:
        return search(q, lang, 5, mode=mode)
    return search(q, lang, 5)


def _decision(results: list[dict], threshold: float) -> dict | None:
    """المادة التي سيعرضها المساعد (نفس منطق pipeline)، أو None = fallback."""
    pick = getattr(search_mod, "pick_match", None)
    if pick:
        return pick(results, threshold)
    top = results[0] if results else None
    return top if top and top["similarity"] >= threshold else None


def evaluate(ids: dict, threshold: float) -> dict:
    """يقيس كل وضع بحث على EVAL_QUESTIONS و EVAL_FAR_QUESTIONS (المواد التجريبية فقط)."""
    key_of = {v: k for k, v in ids.items()}
    report: dict = {"threshold": threshold, "questions": len(EVAL_QUESTIONS),
                    "far_questions": len(EVAL_FAR_QUESTIONS), "modes": {}}
    for mode in _modes():
        print(f"\n— التقييم: {mode} (العتبة {threshold}) —")
        top1 = rr = ok_dec = 0
        sims: list[float] = []
        by_kind: dict[str, list[int]] = {}
        misses: list[str] = []
        t0 = time.perf_counter()
        for key, q, lang, kind in EVAL_QUESTIONS:
            res = [r for r in _run(q, lang, mode) if r["post_id"] in key_of]
            rank = next((i + 1 for i, r in enumerate(res) if r["post_id"] == ids[key]), None)
            hit = rank == 1
            top1 += hit
            rr += 1 / rank if rank else 0
            correct = next((r for r in res if r["post_id"] == ids[key]), None)
            if correct:
                sims.append(correct["similarity"])
            dec = _decision(res, threshold)
            good = dec is not None and dec["post_id"] == ids[key]
            ok_dec += good
            by_kind.setdefault(kind, [0, 0])
            by_kind[kind][0] += hit
            by_kind[kind][1] += 1
            if not (hit and good):
                misses.append(f"[{kind}] {q} → " + ", ".join(
                    f"{key_of[r['post_id']]}={r['similarity']:.3f}" for r in res[:3]))
        far_ok = 0
        far_max = 0.0
        for q, lang in EVAL_FAR_QUESTIONS:
            res = [r for r in _run(q, lang, mode) if r["post_id"] in key_of]
            far_max = max(far_max, res[0]["similarity"] if res else 0.0)
            far_ok += _decision(res, threshold) is None
        n, nf = len(EVAL_QUESTIONS), len(EVAL_FAR_QUESTIONS)
        m = {
            "top1": round(top1 / n, 4), "mrr": round(rr / n, 4),
            "match_decision_acc": round(ok_dec / n, 4), "far_fallback_acc": round(far_ok / nf, 4),
            "overall_decision_acc": round((ok_dec + far_ok) / (n + nf), 4),
            "min_correct_sim": round(min(sims), 4) if sims else None,
            "mean_correct_sim": round(sum(sims) / len(sims), 4) if sims else None,
            "max_far_sim": round(far_max, 4),
            "by_kind": {k: f"{v[0]}/{v[1]}" for k, v in by_kind.items()},
            "ms_per_query": round((time.perf_counter() - t0) * 1000 / (n + nf)),
            "misses": misses,
        }
        report["modes"][mode] = m
        for k in ("top1", "mrr", "match_decision_acc", "far_fallback_acc", "overall_decision_acc",
                  "min_correct_sim", "mean_correct_sim", "max_far_sim", "ms_per_query"):
            print(f"   {k}: {m[k]}")
        print("   حسب النوع (Top-1): " + " · ".join(f"{k} {v}" for k, v in m["by_kind"].items()))
        for line in misses:
            print("   ✗ " + line)
    return report


def suggest_threshold(match_scores: list[float], far_scores: list[float]) -> float | None:
    """منتصف الفجوة بين أضعف تطابق صحيح وأقوى سؤال بعيد (مقرّب لأقرب 0.01)."""
    if not match_scores or not far_scores:
        return None
    lo, hi = max(far_scores), min(match_scores)
    if hi <= lo:
        return None
    return round((lo + hi) / 2, 2)


def _json_path() -> str | None:
    if "--json" in sys.argv:
        i = sys.argv.index("--json")
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else None
    return None


def run_eval_stage(headers: dict, created: dict) -> None:
    create_eval_posts(headers, created)
    if len(created["posts"]) < 5:
        step("مواد التقييم جاهزة", False)
        return
    report = evaluate(created["posts"], get_active_settings().similarity_threshold)
    best = max(m["overall_decision_acc"] for m in report["modes"].values())
    step("التقييم اكتمل", True, f"أفضل دقة قرار = {best}")
    path = _json_path()
    if path:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"   حُفظت الأرقام في {path}")


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
        if "--eval-only" in sys.argv:
            run_eval_stage(headers, created)
            return summary()
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

        # ---------- تقييم الدقة ----------
        run_eval_stage(headers, created)

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
