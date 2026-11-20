"use client";

import { Menu, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { BookIcon } from "@/components/brand";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { key: "library", href: "/library" },
  { key: "shubuhat", href: "/shubuhat" },
  { key: "intro", href: "/intro" },
  { key: "newMuslim", href: "/new-muslim" },
] as const;

function isOn(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Header لاصق (SiteHeader.dc.html): شفاف أعلى الصفحة ويصبح أبيض بحد عند التمرير. قائمة منبثقة على الجوال. */
export function SiteHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  // القائمة مفتوحة لمسار محدد فقط: تُغلق تلقائياً عند التنقل
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenFor((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    window.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-200",
        scrolled || open ? "border-border bg-surface/95 backdrop-blur" : "border-transparent bg-bg/0",
      )}
    >
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-primary-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t.nav.skip}
      </a>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3.5 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md text-primary-700" aria-label={`${t.meta.siteName} — ${t.nav.home}`}>
          <span className="grid size-9 place-items-center rounded-[10px] bg-primary-700 text-white" aria-hidden>
            <BookIcon className="size-[19px]" />
          </span>
          <span className="text-xl font-extrabold">{t.meta.siteName}</span>
        </Link>

        <nav aria-label={t.nav.main} className="hidden items-center gap-[26px] text-[15px] lg:flex">
          {LINKS.map((l) => {
            const on = isOn(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={cn("transition-colors hover:text-primary-700", on ? "font-bold text-primary-700" : "font-medium text-text-secondary")}
              >
                {t.nav[l.key]}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3.5">
          <LocaleLink className="hidden sm:inline-flex" />
          <Link
            href="/assistant"
            aria-current={isOn(pathname, "/assistant") ? "page" : undefined}
            className="hidden h-11 items-center gap-2 rounded-md bg-primary-700 px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-primary-600 sm:inline-flex"
          >
            <MessageSquare className="size-[18px] rtl:-scale-x-100" aria-hidden />
            {t.nav.ask}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-md text-text hover:bg-surface-muted lg:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" ref={menuRef} className="animate-fade-in border-t border-border bg-surface lg:hidden">
          <nav aria-label={t.nav.main} className="mx-auto flex max-w-[1200px] flex-col px-4 py-3 md:px-8">
            {LINKS.map((l) => {
              const on = isOn(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center rounded-md px-3 text-base",
                    on ? "bg-primary-100 font-bold text-primary-700" : "text-text hover:bg-surface-muted",
                  )}
                >
                  {t.nav[l.key]}
                </Link>
              );
            })}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Link
                href="/assistant"
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary-700 font-bold text-white"
              >
                <MessageSquare className="size-[18px] rtl:-scale-x-100" aria-hidden />
                {t.nav.ask}
              </Link>
              <LocaleLink className="h-12 justify-center rounded-md border border-border" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/** «English» / «العربية» — يبدّل لغة الواجهة (يتغير lang و dir على <html>). */
export function LocaleLink({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  const { locale, t } = useI18n();
  const setLocale = useSetLocale();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      onClick={() => setLocale(next)}
      className={cn(
        "inline-flex min-h-11 items-center px-1 text-sm font-medium underline-offset-4 hover:underline",
        tone === "inverse" ? "text-white" : "text-text-secondary hover:text-primary-700",
        className,
      )}
      aria-label={`${t.lang.label}: ${t.lang.switchTo}`}
    >
      {t.lang.switchTo}
    </button>
  );
}
