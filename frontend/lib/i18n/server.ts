import "server-only";
import { cookies, headers } from "next/headers";
import { DICTIONARIES, isLocale, LOCALE_COOKIE, type Dict, type Locale } from "./dictionaries";

/** المسارات التي تبقى عربية دائماً (لوحة التحكم ونظام التصميم). */
export const ARABIC_ONLY = ["/admin", "/design-system"];

export async function getPathname(): Promise<string> {
  return (await headers()).get("x-daiah-path") ?? "/";
}

/** لغة الموقع من الكوكي (العربية افتراضياً). اللوحة عربية دائماً. */
export async function getLocale(): Promise<Locale> {
  const path = await getPathname();
  if (ARABIC_ONLY.some((p) => path === p || path.startsWith(`${p}/`))) return "ar";
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "ar";
}

export async function getI18n(): Promise<{ locale: Locale; t: Dict; dir: "rtl" | "ltr" }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale], dir: locale === "ar" ? "rtl" : "ltr" };
}
