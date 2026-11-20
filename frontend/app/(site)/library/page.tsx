import { Search, SearchX, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/site/cards";
import { FilterForm, FilterSelect } from "@/components/site/filter-form";
import { Pager } from "@/components/site/pager";
import { SiteError } from "@/components/site/states";
import { EmptyState } from "@/components/ui/feedback";
import { fmtNumber } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { tryGet } from "@/lib/public-api";
import { pick } from "@/lib/site";
import type { Category, ContentType, PublicPostPage, PublicSection, PublicTopic } from "@/lib/types";

const PAGE_SIZE = 12;
const TYPES: ContentType[] = ["article", "booklet", "leaflet", "shubha_response"];
const CATEGORIES: Category[] = ["methodology", "shubuhat", "intro_islam", "new_muslim"];
const KEYS = ["q", "section", "category", "topic", "lang", "content_type", "tag"] as const;
type Key = (typeof KEYS)[number];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.library,
    description: t.meta.libraryDesc,
    openGraph: { title: t.meta.library, description: t.meta.libraryDesc, url: "/library" },
  };
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const f = Object.fromEntries(KEYS.map((k) => [k, one(sp[k])])) as Record<Key, string>;
  if (!TYPES.includes(f.content_type as ContentType)) f.content_type = "";
  if (!CATEGORIES.includes(f.category as Category)) f.category = "";
  if (f.lang !== "ar" && f.lang !== "en") f.lang = "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [sections, topics, result] = await Promise.all([
    tryGet<PublicSection[]>("/api/sections"),
    tryGet<PublicTopic[]>("/api/topics", { section: f.section || undefined, category: f.category || undefined }),
    tryGet<PublicPostPage>("/api/posts", {
      q: f.q,
      section: f.section,
      category: f.category,
      topic: f.topic,
      content_type: f.content_type,
      lang: f.lang === "en" ? "en" : undefined,
      tag: f.tag,
      page,
      page_size: PAGE_SIZE,
    }),
  ]);

  const href = (patch: Partial<Record<Key | "page", string>>) => {
    const qs = new URLSearchParams();
    for (const k of KEYS) {
      const v = k in patch ? patch[k as Key] : f[k];
      if (v) qs.set(k, v);
    }
    if (patch.page && patch.page !== "1") qs.set("page", patch.page);
    const s = qs.toString();
    return s ? `/library?${s}` : "/library";
  };

  const sectionLabel = (slug: string) => {
    const s = sections?.find((x) => x.slug === slug);
    return s ? pick(s.name_ar, s.name_en, locale).text : slug;
  };
  const chips: { key: Key; label: string }[] = [];
  if (f.q) chips.push({ key: "q", label: `«${f.q}»` });
  if (f.category) chips.push({ key: "category", label: t.categories[f.category as Category] });
  if (f.section) chips.push({ key: "section", label: sectionLabel(f.section) });
  if (f.topic) chips.push({ key: "topic", label: f.topic });
  if (f.lang) chips.push({ key: "lang", label: f.lang === "en" ? t.library.langEn : t.library.langAr });
  if (f.content_type) chips.push({ key: "content_type", label: t.types[f.content_type as ContentType] });
  if (f.tag) chips.push({ key: "tag", label: `#${f.tag}` });

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pb-[88px] pt-8 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold leading-10 md:text-[34px] md:leading-[46px]">{t.meta.library}</h1>
        <p className="text-[17px] leading-[30px] text-text-secondary">{t.meta.libraryDesc}</p>
      </div>

      <FilterForm key={JSON.stringify(f)} action="/library" role="search" className="flex flex-col gap-4">
        {f.category && <input type="hidden" name="category" value={f.category} />}
        {f.tag && <input type="hidden" name="tag" value={f.tag} />}
        <label htmlFor="lib-q" className="sr-only">
          {t.library.searchLabel}
        </label>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-1.5 ps-4 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
          <Search className="size-5 shrink-0 text-text-muted" aria-hidden />
          <input
            id="lib-q"
            name="q"
            type="search"
            defaultValue={f.q}
            placeholder={t.library.searchPlaceholder}
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-text-muted"
          />
          <button type="submit" className="h-[46px] shrink-0 rounded-md bg-primary-700 px-5 text-[15px] font-bold text-white hover:bg-primary-600 sm:px-[22px]">
            {t.library.search}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold text-text-secondary">{t.library.filter}</span>
          <FilterSelect name="section" label={t.library.section} defaultValue={f.section} className="min-w-0 flex-[1_1_160px] sm:flex-none">
            <option value="">{t.library.allSections}</option>
            {(sections ?? [])
              .filter((s) => !f.category || s.category === f.category)
              .map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.parent_id ? "— " : ""}
                  {pick(s.name_ar, s.name_en, locale).text}
                </option>
              ))}
          </FilterSelect>
          <FilterSelect name="topic" label={t.library.topic} defaultValue={f.topic} className="min-w-0 flex-[1_1_140px] sm:flex-none">
            <option value="">{t.library.allTopics}</option>
            {(topics ?? []).map((tp) => (
              <option key={tp.topic} value={tp.topic}>
                {tp.topic} ({fmtNumber(tp.posts_count, locale)})
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="lang" label={t.library.langLabel} defaultValue={f.lang} className="min-w-0 flex-[1_1_120px] sm:flex-none">
            <option value="">{t.library.allLangs}</option>
            <option value="ar">{t.library.langAr}</option>
            <option value="en">{t.library.langEn}</option>
          </FilterSelect>
          <FilterSelect name="content_type" label={t.library.type} defaultValue={f.content_type} className="min-w-0 flex-[1_1_120px] sm:flex-none">
            <option value="">{t.library.allTypes}</option>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t.types[ty]}
              </option>
            ))}
          </FilterSelect>
          <noscript>
            <button type="submit" className="h-10 rounded-[10px] border border-border px-3 text-sm">
              {t.library.applyFilters}
            </button>
          </noscript>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 py-1.5 pe-2 ps-3 text-[13px] font-bold text-primary-700">
                {c.label}
                <Link
                  href={href({ [c.key]: "" })}
                  scroll={false}
                  aria-label={`${t.common.removeFilter}: ${c.label}`}
                  className="grid size-[22px] place-items-center rounded-full hover:bg-primary-50"
                >
                  <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                </Link>
              </span>
            ))}
            <Link href="/library" scroll={false} className="inline-flex min-h-8 items-center text-[13px] font-bold text-primary-600 hover:text-primary-700">
              {t.common.clearAll}
            </Link>
          </div>
        )}
      </FilterForm>

      {result === null ? (
        <SiteError />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-text-secondary" aria-live="polite">
            <span>{t.common.results(fmtNumber(result.total, locale))}</span>
            <span>{t.library.sortLatest}</span>
          </div>
          {result.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={<SearchX />}
                title={chips.length ? t.library.emptyTitle : t.library.emptyLibrary}
                description={chips.length ? t.library.emptyHint : undefined}
                action={
                  f.q ? (
                    <Link
                      href={`/assistant?q=${encodeURIComponent(f.q)}`}
                      className="inline-flex h-11 items-center rounded-md bg-primary-700 px-5 font-bold text-white hover:bg-primary-600"
                    >
                      {t.nav.ask}
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
              {result.items.map((p) => (
                <PostCard key={p.id} post={p} locale={locale} headingLevel="h2" />
              ))}
            </div>
          )}
          <Pager page={page} total={result.total} pageSize={PAGE_SIZE} hrefFor={(p) => href({ page: String(p) })} locale={locale} />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-approved-border bg-primary-50 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-primary-700">{t.library.notFoundCta}</span>
          <span className="text-[15px] text-text-secondary">{t.library.notFoundCtaHint}</span>
        </div>
        <Link
          href={f.q ? `/assistant?q=${encodeURIComponent(f.q)}` : "/assistant"}
          className="inline-flex h-11 items-center rounded-md bg-primary-700 px-5 font-bold text-white hover:bg-primary-600"
        >
          {t.nav.ask}
        </Link>
      </div>
    </div>
  );
}
