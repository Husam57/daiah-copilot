import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

/** هيكل الموقع العام: Header لاصق + المحتوى + Footer. اللغة من الكوكي (العربية افتراضياً). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale}>
      <div className="flex min-h-dvh flex-col bg-bg">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
