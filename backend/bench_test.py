r"""قياس زمن الاستجابة: POST /api/chat (أسئلة جديدة ومتكررة) + المسارات العامة (يحذف كل ما ينشئه).

- /api/chat: 6 أسئلة، كل سؤال 3 مرات (الأولى «جديد»، والباقي «متكرر» يستفيد من كاش التضمين).
- المسارات العامة: كل مسار 6 مرات (الأولى بلا كاش، والباقي من الكاش إن وُجد).
القياس داخل العملية (TestClient) فيُحسب زمن الخادم + Supabase + Gemini، بلا شبكة المتصفح.

التشغيل (من مجلد backend):  .venv\Scripts\python.exe bench_test.py [--json PATH]
"""
import json
import secrets
import statistics
import sys
import time

from app.db import get_supabase
from app.routers.chat import reset_rate_limit
from testkit import TAG, cleanup, client, create_fixtures, login, publish_all, step, summary

QUESTIONS = [
    ("كم ساعة شمس تحتاج نبتة الطماطم؟", "ar"),
    ("كيف أنظف سلسلة الدراجة وأزيتها؟", "ar"),
    ("كيف أنظم وقت المذاكرة قبل الامتحان؟", "ar"),
    ("How much sunlight do tomato plants need?", "en"),
    ("ما هي عاصمة أستراليا؟", "ar"),
    ("ما أفضل طريقة لتعلم العزف على البيانو؟", "ar"),
]
REPEATS = 3


def _stats(xs: list[float]) -> dict:
    xs = sorted(xs)
    if not xs:
        return {}
    p95 = xs[min(len(xs) - 1, round(0.95 * (len(xs) - 1)))]
    return {"n": len(xs), "mean": round(statistics.mean(xs)), "p50": round(statistics.median(xs)),
            "p95": round(p95), "min": round(xs[0]), "max": round(xs[-1])}


def _timed(fn) -> tuple[float, object]:
    t0 = time.perf_counter()
    r = fn()
    return (time.perf_counter() - t0) * 1000, r


def main() -> int:
    out_path = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    headers = login()
    created = create_fixtures(headers)
    session = f"bench-{secrets.token_hex(4)}"
    report: dict = {}
    try:
        publish_all(headers, created)
        # ---------- /api/chat ----------
        first, repeat, errors = [], [], 0
        for rnd in range(REPEATS):
            for q, lang in QUESTIONS:
                reset_rate_limit()
                ms, r = _timed(lambda: client.post("/api/chat", json={
                    "message": q, "lang": lang, "session_id": session}))
                if r.status_code != 200:
                    errors += 1
                    continue
                (first if rnd == 0 else repeat).append(ms)
        report["chat"] = {"first": _stats(first), "repeat": _stats(repeat),
                          "all": _stats(first + repeat), "errors": errors}
        step("/api/chat بلا أخطاء", errors == 0, f"أخطاء={errors}")
        print(f"   /api/chat جديد:   {report['chat']['first']}")
        print(f"   /api/chat متكرر:  {report['chat']['repeat']}")

        # ---------- المسارات العامة ----------
        slug = f"test-garden-{TAG}"
        routes = ["/api/sections", "/api/categories", "/api/posts", "/api/posts/latest?limit=6",
                  f"/api/posts/{slug}", f"/api/posts/{slug}/related", "/api/topics"]
        report["public"] = {}
        for path in routes:
            times = []
            for _ in range(6):
                ms, r = _timed(lambda: client.get(path))
                if r.status_code == 200:
                    times.append(ms)
            cold, warm = times[:1], times[1:]
            report["public"][path.replace(slug, "{slug}")] = {
                "cold": round(cold[0]) if cold else None, "warm": _stats(warm)}
            print(f"   GET {path.replace(slug, '{slug}')}: أول طلب {round(cold[0]) if cold else '—'} ms، "
                  f"بعده p50 {_stats(warm).get('p50')} ms")
        step("المسارات العامة تعمل", all(v["cold"] is not None for v in report["public"].values()))
    finally:
        deleted = get_supabase().table("chat_logs").delete().eq("session_id", session).execute().data
        print(f"🧹 حُذفت {len(deleted or [])} من سجلات المحادثة التجريبية")
        cleanup(headers, created)
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"   حُفظت الأرقام في {out_path}")
    return summary()


if __name__ == "__main__":
    sys.exit(main())
