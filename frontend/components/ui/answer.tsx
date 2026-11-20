"use client";

import { BadgeCheck, Building2, Compass, ExternalLink, Globe, Mail, SearchX } from "lucide-react";
import * as React from "react";
import type { ReferralCenter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { SafeHtml } from "./safe-html";

/* ============================================================
   صوت المنصة مقابل صوت المساعد — يجب أن يميّزهما المستخدم من النظرة الأولى.
   ============================================================ */

/** ⭐ بطاقة "نص معتمد": نص المنشور حرفياً (منظّف) مع مصدره. */
export function ApprovedTextCard({
  title,
  sectionName,
  html,
  sourceName,
  externalRef,
  readMoreHref,
  lang = "ar",
  langFallback,
  className,
}: {
  title: string;
  sectionName?: string | null;
  html: string;
  sourceName?: string | null;
  externalRef?: string | null;
  readMoreHref?: string;
  lang?: "ar" | "en";
  /** طُلبت الإنجليزية ولا توجد نسخة: يُعرض العربي */
  langFallback?: boolean;
  className?: string;
}) {
  const dir = lang === "en" ? "ltr" : "rtl";
  return (
    <article
      className={cn("overflow-hidden rounded-lg border border-approved-border bg-primary-50", className)}
      aria-label="نص معتمد من المنصة"
    >
      <header className="flex items-center justify-between gap-3 bg-primary-700 px-4 py-2.5 text-white">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <BadgeCheck className="size-4.5" aria-hidden />
          نص معتمد من المنصة
        </span>
        {sectionName && (
          <span className="truncate text-xs font-medium text-white/85" lang={lang} dir={dir}>
            {sectionName}
          </span>
        )}
      </header>
      <div className="px-5 py-5" lang={lang} dir={dir}>
        {langFallback && (
          <p className="mb-3 rounded-sm bg-surface px-2.5 py-1.5 text-xs text-text-secondary" lang="ar" dir="rtl">
            لا تتوفر نسخة إنجليزية من هذه المادة، فعُرض النص العربي.
          </p>
        )}
        <h3 className="text-h3 text-primary-700">{title}</h3>
        <SafeHtml html={html} className="mt-3 text-body" />
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-approved-border px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span className="min-w-0">
            <span className="text-text-muted">المصدر: </span>
            <span className="font-medium text-text">{sourceName || "—"}</span>
          </span>
          {externalRef && (
            <a
              href={externalRef}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-600 hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              الرابط الأصلي
            </a>
          )}
        </div>
        {readMoreHref && (
          <Button asChild variant="secondary" size="sm">
            <a href={readMoreHref} target="_blank" rel="noopener noreferrer">
              اقرأ المادة كاملة
            </a>
          </Button>
        )}
      </footer>
    </article>
  );
}

/** فقاعة توجيه المساعد: نص قصير فقط. */
export function GuidanceBubble({
  text,
  lang = "ar",
  className,
}: {
  text: string;
  lang?: "ar" | "en";
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span
        className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-primary-600"
        aria-hidden
      >
        <Compass className="size-4" />
      </span>
      <div className="max-w-prose rounded-lg rounded-ss-sm border border-border bg-surface px-4 py-2.5 shadow-sm">
        <p className="text-xs text-text-muted">رفيق الداعية</p>
        <p className="text-body text-text" lang={lang} dir={lang === "en" ? "ltr" : "rtl"}>
          {text}
        </p>
      </div>
    </div>
  );
}

/* ---------- SourceChip ---------- */
export function SourceChip({
  index,
  title,
  similarity,
  href,
  onClick,
  muted,
  className,
}: {
  index: number;
  title: string;
  similarity?: number | null;
  href?: string;
  onClick?: () => void;
  muted?: boolean;
  className?: string;
}) {
  const pct = similarity === null || similarity === undefined ? null : Math.round(similarity * 100);
  const body = (
    <>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
          muted ? "bg-surface-muted text-text-muted" : "bg-primary-100 text-primary-700",
        )}
      >
        {index}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{title}</span>
      {pct !== null && (
        <span className="flex shrink-0 items-center gap-1.5" aria-label={`نسبة التشابه ${pct}%`}>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <span
              className={cn("block h-full rounded-full", muted ? "bg-text-muted" : "bg-primary-500")}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </span>
          <span className="w-8 text-xs tabular-nums text-text-secondary">{pct}%</span>
        </span>
      )}
    </>
  );
  const cls = cn(
    "flex min-h-11 w-full items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-start transition-[border-color,box-shadow] duration-150 hover:border-primary-500/40 hover:shadow-sm",
    className,
  );
  if (href)
    return (
      <a href={href} className={cls}>
        {body}
      </a>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/* ---------- FallbackCard ---------- */
export function FallbackCard({
  message,
  closest,
  referrals,
  className,
  lang = "ar",
}: {
  message?: string;
  closest?: { title: string; similarity?: number | null; href?: string } | null;
  referrals: ReferralCenter[];
  className?: string;
  lang?: "ar" | "en";
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface-muted p-5", className)} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-text-secondary">
          <SearchX className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 text-text">هذه المسألة غير متوفرة في المنصة حالياً</h3>
          {message && (
            <p className="mt-1 text-sm font-normal text-text-secondary" lang={lang} dir={lang === "en" ? "ltr" : "rtl"}>
              {message}
            </p>
          )}
        </div>
      </div>

      {closest && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-text">أقرب مادة ذات صلة</p>
          <SourceChip index={1} title={closest.title} similarity={closest.similarity} href={closest.href} muted />
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-bold text-text">تواصل مع المراكز المعتمدة</p>
        {referrals.length === 0 ? (
          <p className="text-sm font-normal text-text-muted">لم تُضف مراكز معتمدة بعد.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {referrals.map((c) => (
              <ReferralCard key={c.id} center={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ReferralCard({ center, actions }: { center: ReferralCenter; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-bold leading-6 text-text">{center.name}</p>
            {center.country && <p className="text-xs text-text-muted">{center.country}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {center.url && (
          <a
            href={center.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 text-primary-600 hover:underline"
            dir="ltr"
          >
            <Globe className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{center.url.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {center.contact && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-text-secondary">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate" dir="auto">
              {center.contact}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
