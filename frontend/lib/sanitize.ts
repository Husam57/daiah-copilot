import DOMPurify from "dompurify";

let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  // كل الروابط الخارجية تُفتح في نافذة جديدة بأمان
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

/**
 * ينظّف HTML المنشورات (من TipTap) قبل عرضه — يمنع XSS.
 * يعمل في المتصفح فقط؛ على الخادم يرجع نصاً فارغاً (المكوّن يعرض بعد التركيب).
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || typeof window === "undefined" || !DOMPurify.isSupported) return "";
  configure();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "button", "object", "embed"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    ALLOW_DATA_ATTR: false,
  });
}
