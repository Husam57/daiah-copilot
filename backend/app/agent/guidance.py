"""جملة توجيه قصيرة (≤ 30 كلمة) مبنية على عنوان المادة واسم القسم فقط — لا على محتواها ولا على السؤال.

القواعد الثابتة هنا في الكود، و guidance_prompt من اللوحة يُضاف بعدها للأسلوب فقط.
إذا فشل Gemini أو خالف الشروط -> قالب ثابت.
"""
import re

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
    "ar": "وجدتُ لك مادة معتمدة بعنوان «{title}» في قسم «{section}»، تجدها كاملة أدناه.",
    "en": "Here is an approved material titled “{title}” from the “{section}” section; you can read it in full below.",
}

# مؤشرات أن النموذج خرج عن التوجيه (اقتباس نصوص أو أحكام)
_FORBIDDEN = re.compile(
    r"(قال الله|قال تعالى|قال رسول|صلى الله عليه|حديث|﴿|﴾|حلال|حرام|يجب عليك|فتوى|"
    r"\bhalal\b|\bharam\b|\bfatwa\b|\bhadith\b|\bAllah says\b)",
    re.I,
)


def template(title: str, section: str, lang: str) -> str:
    return TEMPLATES["en" if lang == "en" else "ar"].format(title=title, section=section or "—")


def _valid(text: str) -> bool:
    words = text.split()
    return 0 < len(words) <= MAX_WORDS and "\n" not in text and not _FORBIDDEN.search(text)


def make_guidance(title: str, section: str, lang: str, style_prompt: str = "") -> dict:
    """{text, source: 'model'|'template', model}"""
    system = SYSTEM_RULES
    if style_prompt and style_prompt.strip():
        system += "\n\nتعليمات الأسلوب (من لوحة التحكم):\n" + style_prompt.strip()[:2000]
    language = "English" if lang == "en" else "العربية"
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
    return {"text": template(title, section, lang), "source": "template", "model": None}
