"use client";

import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { LocaleLink } from "./header";

/** التذييل (Main.dc.html): الاسم ووصف، روابط، الحقوق ومبدّل اللغة. */
export function SiteFooter() {
  const { t, locale } = useI18n();
  return (
    <footer className="bg-primary-700 text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-8 pt-14 md:px-8">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="flex max-w-[360px] flex-col gap-2.5">
            <span className="text-[22px] font-extrabold">{t.meta.siteName}</span>
            <span className="text-[15px] leading-[26px] text-[#D3E6E2]">{t.footer.about}</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#D3E6E2]">
              <BadgeCheck className="size-4" aria-hidden />
              {t.footer.sourced}
            </span>
          </div>
          <nav aria-label={t.footer.links} className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            <Link href="/" className="min-h-11 py-2.5 hover:underline">
              {t.nav.home}
            </Link>
            <Link href="/library" className="min-h-11 py-2.5 hover:underline">
              {t.nav.library}
            </Link>
            <Link href="/assistant" className="min-h-11 py-2.5 hover:underline">
              {t.nav.assistant}
            </Link>
            <Link href="/shubuhat" className="min-h-11 py-2.5 hover:underline">
              {t.nav.shubuhat}
            </Link>
            <Link href="/new-muslim" className="min-h-11 py-2.5 hover:underline">
              {t.nav.newMuslim}
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-6 text-sm text-[#D3E6E2]">
          <span>{t.footer.rights}</span>
          <span className="flex items-center gap-1">
            <span aria-current="true" className="font-bold text-white">
              {locale === "ar" ? t.lang.ar : t.lang.en}
            </span>
            <span aria-hidden>|</span>
            <LocaleLink tone="inverse" />
          </span>
        </div>
      </div>
    </footer>
  );
}
