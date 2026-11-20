import type { Locale } from "@/lib/i18n/dictionaries";
import type { Category, ContentType, PublicPost, PublicPostCard, SectionRef } from "@/lib/types";

/** نص مترجم إن وُجد، وإلا العربي مع علامة fallback (لعرض تنبيه صغير). */
export interface Localized {
  text: string;
  lang: Locale;
  fallback: boolean;
}

export function pick(ar: string, en: string | null | undefined, locale: Locale): Localized {
  if (locale === "en" && en && en.trim()) return { text: en, lang: "en", fallback: false };
  return { text: ar, lang: "ar", fallback: locale === "en" };
}

export function postTitle(p: Pick<PublicPostCard, "title_ar" | "title_en">, locale: Locale): Localized {
  return pick(p.title_ar, p.title_en, locale);
}

/** مقتطف البطاقة: بالإنجليزية من النص الإنجليزي إن وُجد، وإلا الملخص/المقتطف العربي. */
export function postExcerpt(p: PublicPostCard, locale: Locale): Localized {
  return pick(p.excerpt || p.summary_ar || "", p.has_en ? p.excerpt_en : null, locale);
}

export function sectionName(s: Pick<SectionRef, "name_ar" | "name_en"> | null | undefined, locale: Locale): Localized | null {
  if (!s) return null;
  return pick(s.name_ar, s.name_en, locale);
}

export function readingMinutes(p: Pick<PublicPostCard, "reading_minutes" | "reading_minutes_en" | "has_en">, locale: Locale): number {
  return locale === "en" && p.has_en && p.reading_minutes_en ? p.reading_minutes_en : p.reading_minutes;
}

export const postHref = (slug: string) => `/posts/${encodeURIComponent(slug)}`;

export const isDownloadable = (t: ContentType) => t === "booklet" || t === "leaflet";

/** ألوان شارة نوع المحتوى (Library.dc.html). */
export const TYPE_TONE: Record<ContentType, string> = {
  shubha_response: "bg-danger-bg text-danger-fg",
  article: "bg-info-bg text-info-fg",
  booklet: "bg-success-bg text-success-fg",
  leaflet: "bg-warning-bg text-warning-fg",
};

/** غلاف بطاقة المواد التعريفية (IntroMaterials.dc.html). */
export const TYPE_COVER: Record<ContentType, string> = {
  booklet: "bg-primary-100 text-primary-700",
  leaflet: "bg-accent-100 text-accent-fg",
  article: "bg-info-bg text-info-fg",
  shubha_response: "bg-danger-bg text-danger-fg",
};

export const CATEGORY_HREF: Record<Category, string> = {
  methodology: "/library?category=methodology",
  shubuhat: "/shubuhat",
  intro_islam: "/intro",
  new_muslim: "/new-muslim",
};

export function hasEnglish(p: Pick<PublicPost, "content_en">): boolean {
  return !!(p.content_en && p.content_en.replace(/<[^>]*>/g, "").trim());
}
