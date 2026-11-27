"""استخراج مقتطف حرفي من المادة المعتمدة عند حدود الجمل الكاملة (بلا تلخيص ولا قص لمنتصف جملة).

- الهدف: ~60-85 كلمة بالعربية (55-80 بالإنجليزية) ≈ 5 أسطر سطح مكتب / 8-12 سطر جوال.
- النموذج يختار أرقام الجمل (start/end) فقط في JSON منظم، والـ Backend يجمع الجمل الحرفية من النص الأصلي.
- إذا كانت المادة قصيرة أصلاً تُعرض كاملة، وإذا تعذّر النموذج يُستخدم أقرب نطاق جمل حول المقطع المطابق.
"""
import hashlib
import html
import json
import re
from dataclasses import dataclass

from ..cache import TTLCache
from ..rag.chunking import clean_html
from ..rag.normalize import normalize_ar
from .llm import generate

TARGET_WORDS = {"ar": (60, 85), "en": (55, 80)}
MAX_WORDS = {"ar": 100, "en": 90}
WINDOW_SIZE = 34
EXTRACTOR_TIMEOUT_MS = 20_000

_RE_SENT = re.compile(r"(?<=[.!?؟؛])\s+")

_SYSTEM = """You locate the most relevant verbatim excerpt inside approved Islamic reference texts.
For each material (identified by post_id), you receive numbered sentences [0], [1], ...
Return JSON ONLY with the sentence index range (start, end inclusive) for each post_id that directly answers the user's question.

Strict rules:
1. Select a contiguous range [start, end] of complete sentences from the provided list.
2. Aim for roughly 60 to 85 words (Arabic) or 55 to 80 words (English), never exceeding ~95 words.
3. Prefer complete thoughts and direct answers to the question; do not rewrite or invent anything.
4. Keep start <= end within the provided sentence indices for that post_id."""

_SCHEMA = {
    "type": "object",
    "properties": {
        "selections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "post_id": {"type": "integer"},
                    "start": {"type": "integer"},
                    "end": {"type": "integer"},
                },
                "required": ["post_id", "start", "end"],
            },
        },
    },
    "required": ["selections"],
}

# تخزين اختيارات النموذج لساعة (يتجدد تلقائياً عند تعديل نص المادة لأن بصمة النص ضمن المفتاح)
extractor_cache = TTLCache(maxsize=500, ttl=3600, name="extractor")


@dataclass(frozen=True)
class SentenceUnit:
    para_idx: int
    text: str
    words: int


def split_sentences(raw_html: str | None) -> list[SentenceUnit]:
    """تنظيف HTML وتقسيم النص إلى جمل كاملة مع حفظ رقم الفقرة."""
    body = clean_html(raw_html)
    if not body:
        return []
    units: list[SentenceUnit] = []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    for p_idx, para in enumerate(paragraphs):
        single = re.sub(r"\s*\n\s*", " ", para).strip()
        for s in _RE_SENT.split(single):
            s = s.strip()
            if s:
                units.append(SentenceUnit(para_idx=p_idx, text=s, words=len(s.split())))
    return units


def _strip_chunk_title(chunk: str) -> str:
    if chunk.startswith(("العنوان: ", "Title: ")) and "\n\n" in chunk:
        return chunk.split("\n\n", 1)[1].strip()
    return chunk.strip()


def _best_anchor(units: list[SentenceUnit], matched_chunks: list[str]) -> int:
    """موضع الجملة الأقرب للمقاطع المسترجعة في المادة."""
    if not units or not matched_chunks:
        return 0
    chunk_norms = [normalize_ar(_strip_chunk_title(c)) for c in matched_chunks if c]
    chunk_tokens = [set(c.split()) for c in chunk_norms if c]
    best_idx, best_score = 0, -1.0
    for idx, u in enumerate(units):
        sn = normalize_ar(u.text)
        st = set(sn.split())
        if not st:
            continue
        score = 0.0
        for rank, (cn, ct) in enumerate(zip(chunk_norms, chunk_tokens)):
            weight = 1.0 / (rank + 1)
            if len(sn) >= 16 and sn in cn:
                score += 4.0 * weight
            elif ct:
                overlap = len(st & ct) / max(len(st), 1)
                score += overlap * weight
        if score > best_score:
            best_score = score
            best_idx = idx
    return best_idx


def _candidate_window(units: list[SentenceUnit], anchor: int, size: int = WINDOW_SIZE) -> tuple[int, int]:
    """نافذة جمل متصلة حول الموضع المطابق لتمريرها للنموذج."""
    n = len(units)
    if n <= size:
        return 0, n - 1
    before = size // 3
    start = max(0, anchor - before)
    end = min(n - 1, start + size - 1)
    start = max(0, end - size + 1)
    return start, end


def _fit_span(units: list[SentenceUnit], start: int, end: int, lang: str) -> tuple[int, int]:
    """يضبط [start, end] على حدود جمل كاملة ضمن نطاق الكلمات المطلوب."""
    n = len(units)
    start = max(0, min(start, n - 1))
    end = max(start, min(end, n - 1))
    t_min, t_max = TARGET_WORDS["en" if lang == "en" else "ar"]
    hard_max = MAX_WORDS["en" if lang == "en" else "ar"]

    def count(a: int, b: int) -> int:
        return sum(units[i].words for i in range(a, b + 1))

    # تقليص إذا تجاوز الحد الأقصى (مع بقاء جملة واحدة كاملة على الأقل)
    while end > start and count(start, end) > hard_max:
        end -= 1

    # توسيع للأمام ثم للخلف إذا كان المقتطف قصيراً جداً عن الحد الأدنى المستهدف
    while end + 1 < n and count(start, end) < t_min:
        next_total = count(start, end + 1)
        if next_total > hard_max and count(start, end) >= t_min // 2:
            break
        end += 1
        if count(start, end) >= t_max:
            break

    while start > 0 and count(start, end) < t_min:
        prev_total = count(start - 1, end)
        if prev_total > hard_max and count(start, end) >= t_min // 2:
            break
        start -= 1
        if count(start, end) >= t_max:
            break

    return start, end


def _fallback_span(units: list[SentenceUnit], anchor: int, lang: str) -> tuple[int, int]:
    """اختيار حتمي عند تعذّر النموذج: يبدأ من الجملة المطابقة ويتوسع ضمن الطول المستهدف."""
    t_min, t_max = TARGET_WORDS["en" if lang == "en" else "ar"]
    hard_max = MAX_WORDS["en" if lang == "en" else "ar"]
    n = len(units)
    start = end = max(0, min(anchor, n - 1))
    words = units[anchor].words

    while end + 1 < n and words < t_max:
        nxt = units[end + 1].words
        if words + nxt > hard_max and words >= t_min:
            break
        end += 1
        words += nxt
    while start > 0 and words < t_min:
        prv = units[start - 1].words
        if words + prv > hard_max:
            break
        start -= 1
        words += prv
    return start, end


def _render_span(units: list[SentenceUnit], start: int, end: int) -> tuple[str, str, int]:
    """يركب الفقرات الحرفية (نص عادي + HTML آمن) وعدد الكلمات."""
    chosen = units[start:end + 1]
    paras: list[str] = []
    cur_idx: int | None = None
    buf: list[str] = []
    for u in chosen:
        if cur_idx is None or u.para_idx == cur_idx:
            buf.append(u.text)
            cur_idx = u.para_idx
        else:
            paras.append(" ".join(buf))
            buf = [u.text]
            cur_idx = u.para_idx
    if buf:
        paras.append(" ".join(buf))
    text = "\n\n".join(paras)
    html_out = "".join(f"<p>{html.escape(p, quote=False)}</p>" for p in paras)
    word_count = sum(u.words for u in chosen)
    return text, html_out, word_count


def _hash_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def extract_excerpts(question: str, sources: list[dict]) -> tuple[dict[int, dict], dict]:
    """يستخرج مقتطفاً حرفياً (أو النص كاملاً إن كان قصيراً) لكل مصدر في sources.

    كل عنصر في sources يحتوي: {id, lang, content, matched_chunks}.
    يرجع: (map[post_id -> excerpt_dict], meta {source, model}).
    """
    if not sources:
        return {}, {"source": None, "model": None}

    parsed: dict[int, dict] = {}
    need_llm: list[dict] = []
    results: dict[int, dict] = {}

    for src in sources:
        pid = src["id"]
        lang = src["lang"]
        units = split_sentences(src["content"])
        if not units:
            raw = clean_html(src["content"])
            results[pid] = {
                "text": raw,
                "html": f"<p>{html.escape(raw, quote=False)}</p>" if raw else "",
                "word_count": len(raw.split()),
                "is_excerpt": False,
                "truncated_start": False,
                "truncated_end": False,
                "source": "full",
            }
            continue

        total_words = sum(u.words for u in units)
        _, t_max = TARGET_WORDS["en" if lang == "en" else "ar"]
        if total_words <= t_max:
            text, html_out, wc = _render_span(units, 0, len(units) - 1)
            results[pid] = {
                "text": text,
                "html": html_out,
                "word_count": wc,
                "is_excerpt": False,
                "truncated_start": False,
                "truncated_end": False,
                "source": "full",
            }
            continue

        anchor = _best_anchor(units, src.get("matched_chunks") or [])
        w_start, w_end = _candidate_window(units, anchor)
        parsed[pid] = {
            "lang": lang,
            "units": units,
            "anchor": anchor,
            "win": (w_start, w_end),
            "hash": _hash_text(src["content"]),
        }
        need_llm.append(src)

    if not need_llm:
        return results, {"source": "full", "model": None}

    cache_key = (
        normalize_ar(question)[:500],
        tuple((s["id"], s["lang"], parsed[s["id"]]["hash"]) for s in need_llm),
    )
    cached = extractor_cache.get(cache_key)
    model_spans: dict[int, tuple[int, int]] = {}
    used_model: str | None = None
    from_cache = False

    if cached is not None:
        model_spans = cached["spans"]
        used_model = cached["model"]
        from_cache = True
    else:
        sections_txt: list[str] = []
        for s in need_llm:
            pid = s["id"]
            info = parsed[pid]
            w_start, w_end = info["win"]
            lines = [f"[{i}] {info['units'][i].text}" for i in range(w_start, w_end + 1)]
            sections_txt.append(f"post_id: {pid} (lang: {info['lang']})\n" + "\n".join(lines))

        prompt = (
            f"Question:\n<<<\n{question[:800]}\n>>>\n\n"
            "Materials:\n" + "\n\n---\n\n".join(sections_txt)
        )
        raw_json, used_model = generate(
            prompt,
            _SYSTEM,
            json_schema=_SCHEMA,
            max_tokens=320,
            timeout_ms=EXTRACTOR_TIMEOUT_MS,
        )
        if raw_json:
            try:
                payload = json.loads(raw_json)
                for sel in payload.get("selections") or []:
                    pid = sel.get("post_id")
                    if pid in parsed:
                        w_start, w_end = parsed[pid]["win"]
                        a, b = int(sel["start"]), int(sel["end"])
                        if a > b:
                            a, b = b, a
                        if w_start <= a <= w_end and w_start <= b <= w_end:
                            model_spans[pid] = (a, b)
            except (json.JSONDecodeError, TypeError, ValueError, KeyError):
                model_spans = {}

        if len(model_spans) == len(need_llm):
            extractor_cache.set(cache_key, {"spans": model_spans, "model": used_model})

    sources_used: set[str] = set()
    for s in need_llm:
        pid = s["id"]
        info = parsed[pid]
        units = info["units"]
        if pid in model_spans:
            a, b = _fit_span(units, *model_spans[pid], info["lang"])
            src_kind = "model"
        else:
            a, b = _fallback_span(units, info["anchor"], info["lang"])
            src_kind = "heuristic"
        sources_used.add(src_kind)
        text, html_out, wc = _render_span(units, a, b)
        results[pid] = {
            "text": text,
            "html": html_out,
            "word_count": wc,
            "is_excerpt": a > 0 or b < len(units) - 1,
            "truncated_start": a > 0,
            "truncated_end": b < len(units) - 1,
            "source": src_kind,
        }

    overall_source = (
        "model" if sources_used == {"model"}
        else "heuristic" if "heuristic" in sources_used and "model" not in sources_used
        else "mixed" if len(sources_used) > 1
        else "full"
    )
    return results, {
        "source": overall_source,
        "model": used_model if "model" in sources_used else None,
        "cached": from_cache,
    }
