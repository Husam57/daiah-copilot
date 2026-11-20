"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { DICTIONARIES, LOCALE_COOKIE, type Dict, type Locale } from "./dictionaries";

interface I18nValue {
  locale: Locale;
  t: Dict;
  dir: "rtl" | "ltr";
}

const Ctx = React.createContext<I18nValue>({ locale: "ar", t: DICTIONARIES.ar, dir: "rtl" });

/** يُمرَّر اسم اللغة فقط من الخادم، والقاموس يُحمَّل هنا (فيه دوال لا تُسلسَل). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ locale, t: DICTIONARIES[locale], dir: (locale === "ar" ? "rtl" : "ltr") as "rtl" | "ltr" }),
    [locale],
  );
  // ضمان lang/dir على <html> بعد التنقل من جهة العميل (الـ root layout لا يُعاد رسمه دائماً)
  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = value.dir;
  }, [locale, value.dir]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return React.useContext(Ctx);
}

/** يبدّل لغة الواجهة: كوكي لسنة ثم إعادة رسم من الخادم (تتغير lang و dir على <html>). */
export function useSetLocale() {
  const router = useRouter();
  return React.useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      router.refresh();
    },
    [router],
  );
}
