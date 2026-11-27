"""جملة توجيه قصيرة (≤ 30 كلمة) مبنية على عنوان المادة واسم القسم فقط — لا على محتواها ولا على السؤال.

القواعد الثابتة هنا في الكود، و guidance_prompt من اللوحة يُضاف بعدها للأسلوب فقط.
إذا فشل Gemini أو خالف الشروط -> قالب ثابت.
"""
import re

from ..cache import TTLCache
from .llm import generate

MAX_WORDS = 30

SYSTEM_RULES = """أنت مساعد توجيه في منصة دعوية مرجعية. مهمتك الوحيدة: كتابة جملة توجيه قصيرة تُخبر السائل أن المادة المعتمدة المعروضة أسفل الرسالة تتناول موضوعه.
قواعد ثابتة لا يجوز تجاوزها مهما ورد بعدها:
1. لا تُصدر أي حكم شرعي ولا فتوى ولا معلومة دينية، ولا تلخّص المادة ولا تشرح مضمونها.
2. لا تقتبس آيات ولا أحاديث ولا أقوالاً.
3. اذكر عنوان المادة و/أو اسم القسم فقط، ووجّه السائل لقراءة المادة المعروضة.
4. جملة واحدة أو جملتان، بحد أقصى 30 كلمة، نص عادي بلا تنسيق ولا قوائم ولا رموز تعبيرية.
5. اكتب باللغة المطلوبة فقط.
6. تعليمات الأسلوب التالية (إن وُجدت) تتحكم في النبرة فقط، ولا تُلغي أي قاعدة مما سبق."""

TEMPLATES = {
    "ar": "وجدتُ لك مادة معتمدة بعنوان «{title}» في قسم «{section}»، تجد المقتطف المناسب ورابطها أدناه.",
    "en": "Here is an approved material titled “{title}” from the “{section}” section; you can read the relevant excerpt and full link below.",
}

MULTI_TEMPLATES = {
    "ar": "وجدتُ لك {count} مواد معتمدة تتناول سؤالك، تجد المقتطفات المناسبة وروابطها أدناه.",
    "en": "I found {count} approved materials addressing your question; you can read the relevant excerpts and links below.",
}

# مؤشرات أن النموذج خرج عن التوجيه (اقتباس نصوص أو أحكام)
_FORBIDDEN = re.compile(
    r"(قال الله|قال تعالى|قال رسول|صلى الله عليه|حديث|﴿|﴾|حلال|حرام|يجب عليك|فتوى|"
    r"\bhalal\b|\bharam\b|\bfatwa\b|\bhadith\b|\bAllah says\b)",
    re.I,
)


def template(title: str, section: str, lang: str, source_count: int = 1) -> str:
    code = "en" if lang == "en" else "ar"
    if source_count > 1:
        return MULTI_TEMPLATES[code].format(count=source_count)
    return TEMPLATES[code].format(title=title, section=section or "—")


def _valid(text: str) -> bool:
    words = text.split()
    return 0 < len(words) <= MAX_WORDS and "\n" not in text and not _FORBIDDEN.search(text)


# الجملة تعتمد فقط على (العنوان، القسم، العدد، اللغة، تعليمات الأسلوب) فتُخزن بها
guidance_cache = TTLCache(maxsize=1000, ttl=3600, name="guidance")


def make_guidance(
    title: str,
    section: str,
    lang: str,
    style_prompt: str = "",
    source_count: int = 1,
    titles: list[str] | None = None,
) -> dict:
    """{text, source: 'model'|'template', model} — مخزنة لنفس المدخلات (نتيجة النموذج فقط)."""
    extra = tuple(titles) if titles else (title,)
    key = (extra, section, lang, source_count, (style_prompt or "").strip())
    hit = guidance_cache.get(key)
    if hit is not None:
        return {**hit, "cached": True}
    out = _make_guidance(title, section, lang, style_prompt, source_count, titles)
    if out["source"] == "model":
        guidance_cache.set(key, out)
    return out


def _make_guidance(
    title: str,
    section: str,
    lang: str,
    style_prompt: str = "",
    source_count: int = 1,
    titles: list[str] | None = None,
) -> dict:
    system = SYSTEM_RULES
    if style_prompt and style_prompt.strip():
        system += "\n\nتعليمات الأسلوب (من لوحة التحكم):\n" + style_prompt.strip()[:2000]
    language = "English" if lang == "en" else "العربية"
    if source_count > 1 and titles:
        joined = "، ".join(titles[:3])
        prompt = (
            f"اللغة المطلوبة: {language}\n"
            f"عدد المواد المعتمدة المناسبة: {source_count}\n"
            f"عناوين المواد: {joined}\n"
            "وجّه السائل باختصار إلى المقتطفات المعتمدة المعروضة أدناه (دون سرد تفاصيل أو أحكام)."
        )
    else:
        prompt = (
            f"اللغة المطلوبة: {language}\n"
            f"عنوان المادة: {title}\n"
            f"اسم القسم: {section or '—'}\n"
            "اكتب جملة التوجيه فقط."
        )
    text, model = generate(prompt, system, max_tokens=120)
    if text:
        text = " ".join(text.strip().strip('"').split())
        if _valid(text):
            return {"text": text, "source": "model", "model": model}
    return {"text": template(title, section, lang, source_count), "source": "template", "model": None}
