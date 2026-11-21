/**
 * روابط البيئة الوحيدة في الواجهة (لا أسرار): NEXT_PUBLIC_API_URL و NEXT_PUBLIC_SITE_URL.
 * تُكتب حرفياً حتى يضمّنها Next في البناء. قيم localhost في وضع التطوير (next dev) فقط،
 * فلا يحوي بناء الإنتاج أي localhost؛ وبناء Vercel يفشل برسالة واضحة إن غاب أحدهما (next.config.ts).
 * البناء المحلي للاختبار يأخذهما من .env.local.
 */
const clean = (v: string | undefined, devDefault: string) => (v?.trim() || devDefault).replace(/\/+$/, "");
const DEV = process.env.NODE_ENV !== "production";

export const API_URL = clean(process.env.NEXT_PUBLIC_API_URL, DEV ? "http://localhost:8000" : "");
export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL, DEV ? "http://localhost:3000" : "") || "https://example.invalid";
