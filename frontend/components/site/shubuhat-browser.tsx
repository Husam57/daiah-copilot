"use client";

import { Check, HelpCircle, Loader2, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { EmptyState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n/client";
import { fmtNumber } from "@/lib/i18n/dictionaries";
import { postExcerpt, postHref, postTitle, sectionName } from "@/lib/site";
import { qs, siteFetch } from "@/lib/site-api";
import type { PublicPostPage } from "@/lib/types";
import { useDebounced } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Pager } from "./pager";
import { SiteError } from "./states";

export interface ShubhaCategory {
  key: string;
  label: string;
  lang: "ar" | "en";
  count: number;
  /** نوع الفلتر: قسم فرعي أو موضوع */
  param: "section" | "topic";
}

const PAGE_SIZE = 10;

/**
 * موسوعة الشبهات (Shubuhat.dc.html): بحث بارز بنتائج فورية + تصنيفات جانبية.
 * الصفحة الأولى تُرسم على الخادم، والبحث بعدها من المتصفح مع تحديث الرابط.
 */
export function ShubuhatBrowser({
  initial,
  categories,
  initialQ,
  initialCat,
  initialPage,
}: {
  initial: PublicPostPage | null;
  categories: ShubhaCategory[];
  initialQ: string;
  initialCat: string;
  initialPage: number;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = React.useState(initialQ);
  const [cat, setCat] = React.useState(initialCat);
  const [page, setPage] = React.useState(initialPage);
  const [data, setData] = React.useState<PublicPostPage | null>(initial);
  const [error, setError] = React.useState(initial === null);
  const [loading, setLoading] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const debouncedQ = useDebounced(q.trim(), 300);
  const first = React.useRef(true);
  const active = categories.find((c) => c.key === cat);

  React.useEffect(() => {
    if (first.current && nonce === 0) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const query = {
      category: "shubuhat",
      q: debouncedQ,
      [active?.param ?? "section"]: active ? active.key : undefined,
      page,
      page_size: PAGE_SIZE,
    };
    siteFetch<PublicPostPage>(`/api/posts${qs(query)}`, { signal: ctrl.signal })
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch((e) => {
        if ((e as Error)?.name !== "AbortError") setError(true);
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    // الرابط يعكس البحث (للمشاركة والرجوع)
    const url = qs({ q: debouncedQ, cat: cat || undefined, page: page > 1 ? page : undefined });
    router.replace(`${pathname}${url}`, { scroll: false });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, cat, page, nonce]);

  const choose = (key: string) => {
    setCat(key);
    setPage(1);
  };

  return (
    <>
      <section className="bg-primary-700 px-4 py-12 text-white md:px-8 md:py-16">
        <div className="mx-auto flex max-w-[840px] flex-col items-center gap-[18px] text-center">
          <h1 className="text-[30px] font-extrabold leading-10 md:text-[40px] md:leading-[54px]">{t.shubuhat.title}</h1>
          <p className="text-[17px] leading-[30px] text-[#D3E6E2] md:text-lg md:leading-8">{t.shubuhat.desc}</p>
          <form
            role="search"
            className="mt-2 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setNonce((n) => n + 1);
            }}
          >
            <label htmlFor="sh-q" className="sr-only">
              {t.shubuhat.searchLabel}
            </label>
            <div className="flex items-center gap-2.5 rounded-[18px] bg-surface p-2 shadow-[0_16px_40px_rgba(0,0,0,0.15)] focus-within:ring-2 focus-within:ring-primary-500">
              <Search className="ms-3 size-[22px] shrink-0 text-text-muted" aria-hidden />
              <input
                id="sh-q"
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={t.shubuhat.searchPlaceholder}
                className="h-[52px] min-w-0 flex-1 bg-transparent text-lg text-text outline-none placeholder:text-text-muted"
                aria-controls="sh-results"
              />
              <button type="submit" className="h-[52px] shrink-0 rounded-md bg-primary-700 px-5 text-base font-bold text-white hover:bg-primary-600 sm:px-6">
                {t.shubuhat.search}
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-8 px-4 pb-24 pt-10 md:px-8 md:pt-12">
        {categories.length > 0 && (
          <aside aria-label={t.shubuhat.categories} className="flex min-w-0 flex-[1_1_240px] flex-col gap-1 rounded-lg border border-border bg-surface p-4">
            <span className="px-2.5 pb-2.5 pt-1 text-sm font-bold">{t.shubuhat.categories}</span>
            {[{ key: "", label: t.common.all, lang: locale, count: -1, param: "section" as const }, ...categories].map((c) => {
              const on = c.key === cat;
              return (
                <button
                  key={c.key || "all"}
                  type="button"
                  onClick={() => choose(c.key)}
                  aria-pressed={on}
                  className={cn(
                    "flex min-h-[42px] items-center justify-between gap-2 rounded-[10px] px-3 text-start text-[15px]",
                    on ? "bg-primary-100 font-bold text-primary-700" : "font-medium text-text hover:bg-surface-muted",
                  )}
                >
                  <span lang={c.lang}>{c.label}</span>
                  {c.count >= 0 && <span className="text-xs font-medium text-text-muted">{fmtNumber(c.count, locale)}</span>}
                </button>
              );
            })}
          </aside>
        )}

        <section aria-label={t.shubuhat.search} id="sh-results" className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <div className="flex items-center justify-between gap-2 text-sm text-text-secondary" aria-live="polite">
            <span>
              {data &&
                (debouncedQ
                  ? t.shubuhat.resultsFor(debouncedQ, fmtNumber(data.total, locale))
                  : t.shubuhat.resultsAll(fmtNumber(data.total, locale)))}
            </span>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t.shubuhat.searching}
              </span>
            )}
          </div>

          {error ? (
            <SiteError onRetry={() => setNonce((n) => n + 1)} />
          ) : !data ? null : data.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState icon={<SearchX />} title={debouncedQ || cat ? t.shubuhat.emptySearch : t.shubuhat.empty} />
            </div>
          ) : (
            <ul className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
              {data.items.map((p) => {
                const title = postTitle(p, locale);
                const ex = postExcerpt(p, locale);
                const sec = sectionName(p.section, locale);
                return (
                  <li key={p.id}>
                    <Link
                      href={postHref(p.slug)}
                      className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface px-6 py-[22px] shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2.5">
                        <span className="text-[13px] font-bold text-text-muted">{p.topic || sec?.text}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-success-bg px-2.5 py-1 text-xs font-bold text-success-fg">
                          <Check className="size-[13px]" strokeWidth={2.5} aria-hidden />
                          {t.shubuhat.approved}
                        </span>
                      </span>
                      <span className="text-xl font-bold leading-[30px]" lang={title.lang}>
                        {title.text}
                      </span>
                      {ex.text && (
                        <span className="line-clamp-2 text-[15px] leading-[26px] text-text-secondary" lang={ex.lang}>
                          {ex.text}
                        </span>
                      )}
                      <span className="text-sm font-bold text-primary-600">{t.shubuhat.readResponse}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data && (
            <PagerButtons page={page} total={data.total} onPage={setPage} />
          )}

          <div className="flex items-start gap-4 rounded-lg border border-dashed border-border-strong bg-surface-muted px-6 py-[22px]">
            <HelpCircle className="mt-0.5 size-6 shrink-0 text-text-secondary" aria-hidden />
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-bold">{t.shubuhat.missingTitle}</span>
              <span className="text-sm leading-6 text-text-secondary">{t.shubuhat.missingHint}</span>
              <Link
                href={debouncedQ ? `/assistant?q=${encodeURIComponent(debouncedQ)}` : "/assistant"}
                className="inline-flex min-h-11 items-center text-sm font-bold text-primary-600 hover:text-primary-700"
              >
                {t.nav.ask}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/** ترقيم بأزرار (البحث هنا من المتصفح). */
function PagerButtons({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const { locale } = useI18n();
  // نعيد استخدام شكل Pager لكن بأزرار: نلتقط النقر على الروابط
  return (
    <div
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        e.preventDefault();
        const p = Number(new URL(a.href).searchParams.get("page") || "1");
        onPage(p);
        document.getElementById("sh-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      <Pager page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => `?page=${p}`} locale={locale} />
    </div>
  );
}
