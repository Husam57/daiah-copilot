import { BadgeCheck, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { TypeBadge } from "@/components/site/cards";
import { CopyLinkButton } from "@/components/site/copy-link";
import { PostBody, ShubhaResponse } from "@/components/site/post-body";
import { fmtDate, fmtNumber, type Locale } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { publicGet, tryGet } from "@/lib/public-api";
import { CATEGORY_HREF, hasEnglish, pick, postExcerpt, postHref, postTitle, sectionName } from "@/lib/site";
import type { PublicPost, PublicPostCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const loadPost = cache((slug: string) => publicGet<PublicPost>(`/api/posts/${encodeURIComponent(slug)}`, undefined, { notFoundOn404: true }));

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * فهرس المحتويات: يضيف id لكل <h2> (سمة فقط، لا يغيّر النص) ويستخرج عناوينها.
 * النص نفسه يبقى حرفياً كما في قاعدة البيانات، ويُنظَّف بـ DOMPurify عند العرض.
 */
function withToc(html: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (_m, attrs: string | undefined, inner: string) => {
    const id = `s${toc.length + 1}`;
    const text = decode(inner.replace(/<[^>]*>/g, "")).trim();
    if (text) toc.push({ id, text });
    const clean = (attrs ?? "").replace(/\sid="[^"]*"/i, "");
    return `<h2 id="${id}"${clean}>${inner}</h2>`;
  });
  return { html: out, toc };
}

/** لغة المادة: ?lang= ثم لغة الواجهة؛ الإنجليزية فقط إن وُجدت نسختها. */
function contentLang(post: PublicPost, requested: string | undefined, locale: Locale): { lang: Locale; fallback: boolean } {
  const want = requested === "en" || requested === "ar" ? requested : locale;
  if (want === "en" && hasEnglish(post)) return { lang: "en", fallback: false };
  return { lang: "ar", fallback: want === "en" };
}

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale, t } = await getI18n();
  // لا نرمي notFound من الـ metadata (يرجع صفحة خطأ عامة)؛ الصفحة نفسها ترجع 404
  const post = await tryGet<PublicPost>(`/api/posts/${encodeURIComponent(slug)}`);
  if (!post) return { title: t.notFound.title, robots: { index: false } };
  const title = pick(post.title_ar, post.title_en, locale).text;
  const description = (post.summary_ar || post.content_ar.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 180);
  return {
    title,
    description,
    alternates: { canonical: postHref(post.slug) },
    openGraph: {
      type: "article",
      title,
      description,
      url: postHref(post.slug),
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags,
      section: post.section.name_ar,
    },
  };
}

export default async function PostPage({ params, searchParams }: PageProps<"/posts/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { t, locale } = await getI18n();
  const post = await loadPost(slug);
  const related = (await tryGet<PublicPostCard[]>(`/api/posts/${encodeURIComponent(slug)}/related`, { limit: 3 })) ?? [];

  const requested = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const cl = contentLang(post, requested, locale);
  const title = cl.lang === "en" ? post.title_en || post.title_ar : post.title_ar;
  const raw = cl.lang === "en" ? post.content_en! : post.content_ar;
  const { html, toc } = withToc(raw);
  const minutes = cl.lang === "en" && post.reading_minutes_en ? post.reading_minutes_en : post.reading_minutes;
  const sec = sectionName(post.section, locale)!;
  const isShubha = post.content_type === "shubha_response";
  const enAvailable = hasEnglish(post);
  const dir = cl.lang === "en" ? "ltr" : "rtl";
  const categoryHref = CATEGORY_HREF[post.section.category];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 pt-6 md:px-8 md:pt-8">
      <nav aria-label={t.nav.breadcrumb}>
        <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <li>
            <Link href="/" className="hover:text-primary-600">
              {t.nav.home}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/library" className="hover:text-primary-600">
              {t.nav.library}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/library?section=${post.section.slug}`} className="hover:text-primary-600" lang={sec.lang}>
              {sec.text}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="min-w-0 truncate text-text" lang={cl.lang}>
            {title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start gap-12">
        <article className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
          <header className="flex max-w-[720px] flex-col gap-4">
            <div className="flex flex-wrap gap-2" lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
              <Link href={categoryHref} className="rounded-sm bg-primary-100 px-3 py-1 text-[13px] font-bold leading-5 text-primary-700 hover:bg-primary-50">
                {sec.text}
              </Link>
              <TypeBadge type={post.content_type} locale={locale} className="px-3 text-[13px] leading-5" />
            </div>
            {isShubha && <p className="text-sm font-bold text-text-muted">{t.post.shubha}</p>}
            <h1 className="text-[30px] font-extrabold leading-10 text-primary-700 md:text-[40px] md:leading-[54px]" lang={cl.lang} dir={dir}>
              {title}
            </h1>
            {cl.lang === "ar" && post.summary_ar && (
              <p className="text-lg leading-8 text-text-secondary md:text-xl md:leading-[34px]" lang="ar" dir="rtl">
                {post.summary_ar}
              </p>
            )}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted"
              lang={locale}
              dir={locale === "en" ? "ltr" : "rtl"}
            >
              <span>{t.common.minutesRead(fmtNumber(minutes, locale))}</span>
              {post.published_at && (
                <>
                  <span aria-hidden>·</span>
                  <span>{t.post.published(fmtDate(post.published_at, locale))}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-100 px-2.5 py-1 font-bold text-accent-fg">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t.common.verifiedContent}
              </span>
              {enAvailable && (
                <span className="ms-auto inline-flex gap-1 rounded-[10px] bg-surface-muted p-1" role="group" aria-label={t.post.contentLang}>
                  {(["ar", "en"] as const).map((l) => (
                    <Link
                      key={l}
                      href={`${postHref(post.slug)}?lang=${l}`}
                      scroll={false}
                      aria-current={cl.lang === l ? "true" : undefined}
                      lang={l}
                      className={cn(
                        "inline-flex h-[30px] items-center rounded-sm px-3 text-[13px]",
                        cl.lang === l ? "bg-surface font-bold text-primary-700 shadow-sm" : "text-text-secondary hover:text-text",
                      )}
                    >
                      {l === "ar" ? t.lang.ar : t.lang.en}
                    </Link>
                  ))}
                </span>
              )}
            </div>
            {cl.fallback && (
              <p className="rounded-sm bg-info-bg px-3 py-2 text-sm text-info-fg" lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
                {t.common.enOnlyAr}
              </p>
            )}
          </header>

          <div className="h-px max-w-[720px] bg-border" />

          {isShubha ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-text-muted" lang={locale}>
                {t.post.approvedResponse}
              </p>
              <ShubhaResponse
                title={title}
                html={html}
                lang={cl.lang}
                sectionName={sec.text}
                sourceName={post.source_name}
                externalRef={post.external_ref}
              />
            </div>
          ) : (
            <PostBody html={html} lang={cl.lang} />
          )}

          <div className="flex max-w-[680px] flex-col gap-4">
            {/* صندوق المصدر */}
            <section aria-label={t.post.source} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-6 py-5">
              <div className="flex items-center gap-3.5">
                <span className="grid size-11 place-items-center rounded-md bg-accent-100 text-accent-fg">
                  <BadgeCheck className="size-[22px]" aria-hidden />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-text-muted">{t.post.source}</span>
                  <span className="text-base font-bold" lang="ar">
                    {post.source_name || t.post.noSource}
                  </span>
                </div>
              </div>
              {post.external_ref && (
                <a
                  href={post.external_ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-border px-4 text-sm font-bold text-primary-700 hover:bg-primary-50"
                >
                  {t.post.visitSource}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </section>

            {post.file_url && (
              <a
                href={post.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-md bg-primary-700 px-6 font-bold text-white hover:bg-primary-600"
              >
                <Download className="size-[18px]" aria-hidden />
                {t.post.downloadFile}
              </a>
            )}

            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-700 p-6 text-white">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold">{t.post.askTitle}</span>
                <span className="text-[15px] text-[#D3E6E2]">{t.post.askHint}</span>
              </div>
              <Link
                href={`/assistant?q=${encodeURIComponent(title)}`}
                className="inline-flex h-11 items-center rounded-md bg-surface px-5 font-bold text-primary-700 hover:bg-primary-50"
              >
                {t.post.askCta}
              </Link>
            </section>
          </div>
        </article>

        <aside aria-label={t.post.toc} className="flex min-w-0 flex-[1_1_260px] flex-col gap-5 lg:sticky lg:top-24">
          {toc.length > 1 && (
            <nav aria-label={t.post.tocNav} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5" lang={cl.lang} dir={dir}>
              <span className="text-sm font-bold" lang={locale}>
                {t.post.toc}
              </span>
              {toc.map((h, i) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className={cn(
                    "border-s-2 ps-3 text-sm hover:text-primary-700",
                    i === 0 ? "border-primary-700 font-bold text-primary-700" : "border-border text-text-secondary",
                  )}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-5">
              <span className="text-sm font-bold">{t.post.tags}</span>
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/library?tag=${encodeURIComponent(tag)}`}
                    className="rounded-sm bg-surface-muted px-2.5 py-1 text-[13px] text-text hover:bg-primary-100"
                    lang="ar"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <CopyLinkButton path={postHref(post.slug)} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="flex flex-col gap-5 pt-4">
          <h2 className="text-[26px] font-bold leading-9">{t.post.related}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5">
            {related.map((r) => {
              const rt = postTitle(r, locale);
              const rs = sectionName(r.section, locale);
              const ex = postExcerpt(r, locale);
              return (
                <Link
                  key={r.id}
                  href={postHref(r.slug)}
                  className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-[22px] transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  {rs && <span className="text-xs font-bold text-text-muted">{rs.text}</span>}
                  <span className="text-lg font-bold leading-7" lang={rt.lang}>
                    {rt.text}
                  </span>
                  {ex.text && (
                    <span className="line-clamp-2 text-sm text-text-secondary" lang={ex.lang}>
                      {ex.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
