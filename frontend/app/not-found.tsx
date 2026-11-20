import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { NotFoundBody } from "@/components/site/not-found-body";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.notFound.title, robots: { index: false } };
}

/** صفحة 404 بنفس هوية الموقع (تُستخدم للمسارات غير الموجودة ولمادة غير منشورة). */
export default async function NotFound() {
  const { locale } = await getI18n();
  return (
    <I18nProvider locale={locale}>
      <div className="flex min-h-dvh flex-col bg-bg">
        <SiteHeader />
        <main id="main" className="flex flex-1">
          <NotFoundBody />
        </main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
