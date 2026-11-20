import { BadgeCheck, Download } from "lucide-react";
import Link from "next/link";
import { DICTIONARIES, fmtNumber, type Locale } from "@/lib/i18n/dictionaries";
import { isDownloadable, postExcerpt, postHref, postTitle, readingMinutes, sectionName, TYPE_TONE } from "@/lib/site";
import type { ContentType, PublicPostCard } from "@/lib/types";
import { cn } from "@/lib/utils";

/** يعمل في مكونات الخادم والعميل: يأخذ اسم اللغة ويقرأ القاموس بنفسه. */

export function TypeBadge({ type, locale, className }: { type: ContentType; locale: Locale; className?: string }) {
  return (
    <span className={cn("rounded-sm px-2.5 py-1 text-xs font-bold leading-4", TYPE_TONE[type], className)}>
      {DICTIONARIES[locale].types[type]}
    </span>
  );
}

export function VerifiedPill({ locale, long, className }: { locale: Locale; long?: boolean; className?: string }) {
  const t = DICTIONARIES[locale];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm bg-accent-100 px-2.5 py-1 text-xs font-bold leading-4 text-accent-fg", className)}>
      {long && <BadgeCheck className="size-3.5" aria-hidden />}
      {long ? t.common.verifiedContent : t.common.verified}
    </span>
  );
}

export function LangPill({ en, locale }: { en: boolean; locale: Locale }) {
  return (
    <span className="rounded-sm bg-surface-muted px-2.5 py-1 text-xs font-bold leading-4 text-text-secondary" lang={en ? "en" : "ar"}>
      {en ? "EN" : DICTIONARIES[locale].common.arabicBadge}
    </span>
  );
}

/** بطاقة مادة (Library / أحدث المواد): النوع · العنوان · الملخص · الوسوم · القسم · الوقت · قراءة/تحميل. */
export function PostCard({
  post,
  locale,
  headingLevel = "h3",
  showTags = true,
  className,
}: {
  post: PublicPostCard;
  locale: Locale;
  headingLevel?: "h2" | "h3";
  showTags?: boolean;
  className?: string;
}) {
  const t = DICTIONARIES[locale];
  const title = postTitle(post, locale);
  const excerpt = postExcerpt(post, locale);
  const sec = sectionName(post.section, locale);
  const download = isDownloadable(post.content_type) && post.file_url;
  const H = headingLevel;
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-6 shadow-sm transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="flex flex-wrap gap-2">
        <TypeBadge type={post.content_type} locale={locale} />
        {post.has_en ? <LangPill en locale={locale} /> : <VerifiedPill locale={locale} />}
      </div>
      <H className="text-h3" lang={title.lang}>
        <Link href={postHref(post.slug)} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none group-focus-within:underline">
          {title.text}
        </Link>
      </H>
      {excerpt.text && (
        <p className="line-clamp-2 text-[15px] leading-[26px] text-text-secondary" lang={excerpt.lang}>
          {excerpt.text}
        </p>
      )}
      {showTags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-[6px] border border-border px-2 py-0.5 text-xs text-text-secondary" lang="ar">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle pt-2 text-[13px] text-text-muted">
        <span className="min-w-0 truncate">
          {sec && <span lang={sec.lang}>{sec.text}</span>}
          {sec && " · "}
          {download ? "PDF" : t.common.minutes(fmtNumber(readingMinutes(post, locale), locale))}
        </span>
        {download ? (
          <a
            href={post.file_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700"
          >
            <Download className="size-4" aria-hidden />
            {t.common.download}
          </a>
        ) : (
          <span className="text-sm font-bold text-primary-600" aria-hidden>
            {t.common.read}
          </span>
        )}
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6" aria-hidden>
      <div className="h-6 w-24 animate-pulse rounded-sm bg-surface-muted" />
      <div className="h-6 w-3/4 animate-pulse rounded-sm bg-surface-muted" />
      <div className="h-4 w-full animate-pulse rounded-sm bg-surface-muted" />
      <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-muted" />
      <div className="mt-4 h-4 w-1/2 animate-pulse rounded-sm bg-surface-muted" />
    </div>
  );
}
