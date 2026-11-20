"""تقطيع نص المادة إلى مقاطع ~1000 حرف حسب الفقرات، مع تداخل ~150 حرفاً، وتنظيف HTML.

كل مقطع يبدأ بـ "العنوان: ..." (أو "Title: ...") حتى يحمل سياق المادة في البحث.
"""
import html
import re

CHUNK_SIZE = 1000
OVERLAP = 150

_BLOCK_TAGS = r"p|div|br|li|ul|ol|h[1-6]|blockquote|tr|table|section|article|pre"
_RE_SCRIPT = re.compile(r"<(script|style)\b.*?</\1\s*>", re.I | re.S)
_RE_BLOCK = re.compile(rf"</?(?:{_BLOCK_TAGS})\b[^>]*>", re.I)
_RE_TAG = re.compile(r"<[^>]+>")
_RE_SPACES = re.compile(r"[ \t ‏‎]+")
_RE_SENT = re.compile(r"(?<=[.!؟?؛;:\n])\s+")


def clean_html(text: str | None) -> str:
    """يحوّل HTML (من محرر TipTap) إلى نص عادي مع الحفاظ على حدود الفقرات."""
    if not text:
        return ""
    t = _RE_SCRIPT.sub(" ", text)
    t = _RE_BLOCK.sub("\n\n", t)
    t = _RE_TAG.sub("", t)
    t = html.unescape(t)
    lines = [_RE_SPACES.sub(" ", ln).strip() for ln in t.replace("\r", "").split("\n")]
    t = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def _split_long(paragraph: str, size: int) -> list[str]:
    """فقرة أطول من size: تُقسّم على حدود الجمل، ثم الكلمات عند الضرورة."""
    parts: list[str] = []
    cur = ""
    for sent in _RE_SENT.split(paragraph):
        while len(sent) > size:  # جملة طويلة جداً: قص على آخر مسافة
            cut = sent.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            if cur:
                parts.append(cur)
                cur = ""
            parts.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if cur and len(cur) + 1 + len(sent) > size:
            parts.append(cur)
            cur = sent
        else:
            cur = f"{cur} {sent}".strip()
    if cur:
        parts.append(cur)
    return [p for p in parts if p]


def _tail(text: str, n: int) -> str:
    """آخر ~n حرف من النص، تبدأ من بداية كلمة."""
    if len(text) <= n:
        return text
    t = text[-n:]
    sp = t.find(" ")
    return t[sp + 1:] if 0 <= sp < n // 2 else t


def chunk_text(
    content: str | None,
    title: str | None = None,
    lang: str = "ar",
    size: int = CHUNK_SIZE,
    overlap: int = OVERLAP,
) -> list[str]:
    """يرجع قائمة مقاطع جاهزة للـ embedding (فارغة إذا لم يوجد نص)."""
    body = clean_html(content)
    if not body:
        return []
    paragraphs: list[str] = []
    for p in re.split(r"\n\s*\n", body):
        p = p.replace("\n", " ").strip()
        if p:
            paragraphs.extend(_split_long(p, size) if len(p) > size else [p])

    chunks: list[str] = []
    cur = ""
    for p in paragraphs:
        if cur and len(cur) + 2 + len(p) > size:
            chunks.append(cur)
            cur = f"{_tail(cur, overlap)}\n\n{p}" if overlap else p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)

    title = clean_html(title).replace("\n", " ").strip()
    if title:
        prefix = "العنوان: " if lang == "ar" else "Title: "
        chunks = [f"{prefix}{title}\n\n{c}" for c in chunks]
    return chunks
