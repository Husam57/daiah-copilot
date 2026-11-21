import DOMPurify from "isomorphic-dompurify";

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
 * يعمل في الخادم (isomorphic-dompurify عبر jsdom) والمتصفح (DOMPurify) بنفس الإعدادات،
 * فيظهر نص المادة كاملاً في HTML الخادم، ويطابق ناتج المتصفح عند الـ hydration.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  configure();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "button", "object", "embed"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    ALLOW_DATA_ATTR: false,
  });
}
