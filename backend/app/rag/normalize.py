"""توحيد النص العربي للبحث فقط (التضمين والبحث النصي). النص المحفوظ والمعروض لا يتغير أبداً.

- أ إ آ ٱ ← ا ، ى ← ي ، ة ← ه
- حذف التشكيل (الحركات، التنوين، الشدة، السكون، الألف الخنجرية، علامات المصحف) والتطويل (ـ)
- توحيد أشكال العرض (NFKC) والمسافات: أي تتابع مسافات/تبويب = مسافة واحدة، والأسطر تبقى
- الحروف اللاتينية كما هي

نفس القواعد مكررة في SQL (daiah_normalize_ar في db/schema.sql) للبحث النصي؛ أي تعديل هنا يُنقل هناك.
"""
import re
import unicodedata

# التشكيل: 064B-065F (حركات وتنوين وشدة وسكون...)، 0670 الألف الخنجرية،
# 0610-061A و 06D6-06ED علامات قرآنية، 08D3-08FF علامات ممتدة
_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]")
_TATWEEL = "ـ"
_MAP = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي",
    "ة": "ه",
})
_SPACES = re.compile(r"[ \t ‏‎​  ]+")
_BLANK_LINES = re.compile(r"\n{3,}")


def normalize_ar(text: str | None) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = _DIACRITICS.sub("", t).replace(_TATWEEL, "")
    t = t.translate(_MAP)
    lines = [_SPACES.sub(" ", ln).strip() for ln in t.replace("\r", "").split("\n")]
    return _BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()
