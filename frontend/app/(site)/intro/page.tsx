import { BookOpen, Columns3, FileText, MessageSquareQuote, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/site/copy-link";
import { Pager } from "@/components/site/pager";
import { SiteError } from "@/components/site/states";
import { EmptyState } from "@/components/ui/feedback";
import { getI18n } from "@/lib/i18n/server";
import { tryGet } from "@/lib/public-api";
import { postExcerpt, postHref, postTitle, TYPE_COVER } from "@/lib/site";
import type { ContentType, PublicPostPage } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 16;
const COVER_ICON: Record<ContentType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  booklet: BookOpen,
  leaflet: Columns3,
  article: FileText,
  shubha_response: MessageSquareQuote,
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.intro,
    description: t.meta.introDesc,
    openGraph: { title: t.meta.intro, description: t.meta.introDesc, url: "/intro" },
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function IntroPage({ searchParams }: PageProps<"/intro">) {
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const lang = one(sp.lang) === "en" ? "en" : one(sp.lang) === "ar" ? "ar" : "";
  const type = (["booklet", "leaflet", "article"] as const).find((x) => x === one(sp.type)) ?? "";
  const section = one(sp.section);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const data = await tryGet<PublicPostPage>("/api/posts", {
    category: "intro_islam",
    section: section || undefined,
    lang: lang === "en" ? "en" : undefined,
    content_type: type || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { lang, type, section, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/intro?${s}` : "/intro";
  };

  const seg = (items: { v: string; label: string; lang?: string }[], current: string, key: string, legend: string) => (
    <div role="group" aria-label={legend} className="flex flex-wrap gap-1 rounded-md bg-surface-muted p-1">
      {items.map((it) => {
        const on = it.v === current;
        return (
          <Link
            key={it.v || "all"}
            href={href({ [key]: it.v, page: "" })}
            scroll={false}
            aria-current={on ? "true" : undefined}
            lang={it.lang}
            className={cn(
              "inline-flex h-9 items-center rounded-[9px] px-3.5 text-sm",
              on ? "bg-surface font-bold text-primary-700 shadow-[0_1px_2px_rgba(16,24,20,0.08)]" : "text-text-secondary hover:text-text",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pb-24 pt-8 md:px-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-10 md:text-[34px] md:leading-[46px]">{t.intro.title}</h1>
          <p className="text-[17px] leading-[30px] text-text-secondary">{t.intro.desc}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {seg(
            [
              { v: "", label: t.common.all },
              { v: "ar", label: t.lang.ar, lang: "ar" },
              { v: "en", label: t.lang.en, lang: "en" },
            ],
            lang,
            "lang",
            t.intro.lang,
          )}
          {seg(
            [
              { v: "", label: t.typesPlural.all },
              { v: "booklet", label: t.typesPlural.booklet },
              { v: "leaflet", label: t.typesPlural.leaflet },
              { v: "article", label: t.typesPlural.article },
            ],
            type,
            "type",
            t.intro.type,
          )}
        </div>
      </div>

      {data === null ? (
        <SiteError />
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<SearchX />}
            title={t.intro.empty}
            description={t.intro.emptyHint}
            action={
              <Link href="/library" className="inline-flex h-11 items-center rounded-md border border-border px-5 font-bold hover:bg-primary-50">
                {t.nav.library}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5">
          {data.items.map((m) => {
            const Icon = COVER_ICON[m.content_type];
            // في فلتر English نعرض العنوان الإنجليزي حتى لو كانت الواجهة عربية
            const showEn = lang === "en" || locale === "en";
            const title = postTitle(m, showEn ? "en" : "ar");
            const desc = postExcerpt(m, showEn ? "en" : "ar");
            const pdf = m.file_url && (m.content_type === "booklet" || m.content_type === "leaflet");
            return (
              <article key={m.id} className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-md">
                <div className={cn("relative grid h-[150px] place-items-center", TYPE_COVER[m.content_type])}>
                  <Icon className="size-11" strokeWidth={1.6} aria-hidden />
                  <span className="absolute start-3 top-3 rounded-[7px] bg-surface px-2 py-0.5 text-xs font-bold text-text">{t.types[m.content_type]}</span>
                  <span className="absolute end-3 top-3 rounded-[7px] bg-white/80 px-2 py-0.5 text-xs font-bold text-text" lang={m.has_en ? "en" : "ar"}>
                    {m.has_en ? "EN" : t.common.arabicBadge}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-[18px]">
                  <h2 className="text-[17px] font-bold leading-[26px]" lang={title.lang}>
                    <Link href={postHref(m.slug)} className="hover:text-primary-700">
                      {title.text}
                    </Link>
                  </h2>
                  {desc.text && (
                    <p className="line-clamp-2 text-sm leading-6 text-text-secondary" lang={desc.lang}>
                      {desc.text}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2 pt-2.5">
                    {pdf ? (
                      <a
                        href={m.file_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary-700 text-sm font-bold text-white hover:bg-primary-600"
                      >
                        {t.common.downloadPdf}
                      </a>
                    ) : (
                      <Link
                        href={postHref(m.slug)}
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-primary-700 text-sm font-bold text-white hover:bg-primary-600"
                      >
                        {t.common.read}
                      </Link>
                    )}
                    <CopyLinkButton path={postHref(m.slug)} variant="icon" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {data && <Pager page={page} total={data.total} pageSize={PAGE_SIZE} hrefFor={(p) => href({ page: String(p) })} locale={locale} />}
    </div>
  );
}
