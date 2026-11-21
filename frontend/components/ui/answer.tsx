"use client";

import { Building2, ExternalLink, Globe, Mail, SearchX, ShieldCheck } from "lucide-react";
import * as React from "react";
import { BookIcon } from "@/components/brand";
import type { TextBlock } from "@/lib/html-blocks";
import type { ReferralCenter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SafeHtml } from "./safe-html";

/* ============================================================
   صوت المنصة مقابل صوت المساعد — يجب أن يميّزهما المستخدم من النظرة الأولى.
   التسميات افتراضياً بالعربية، ويمرّر الموقع العام التسميات الإنجليزية عند الحاجة.
   ============================================================ */

export interface AnswerLabels {
  approvedHeader: string;
  sourcePrefix: string;
  originalLink: string;
  readFull: string;
  langFallbackNote: string;
  fallbackTitle: string;
  closest: string;
  read: string;
  centers: string;
  visitSite: string;
  noCenters: string;
  bot: string;
}

export const AR_LABELS: AnswerLabels = {
  approvedHeader: "نص معتمد من المنصة",
  sourcePrefix: "المصدر: ",
  originalLink: "الرابط الأصلي",
  readFull: "اقرأ المادة كاملة",
  langFallbackNote: "لا تتوفر نسخة إنجليزية من هذه المادة، فعُرض النص العربي.",
  fallbackTitle: "هذه المسألة غير متوفرة في المنصة حالياً",
  closest: "أقرب مادة ذات صلة",
  read: "قراءة",
  centers: "مراكز ودعاة معتمدون",
  visitSite: "زيارة الموقع",
  noCenters: "لم تُضف مراكز معتمدة بعد.",
  bot: "رفيق الداعية",
};

const isInternal = (href: string) => href.startsWith("/");

/** ⭐ بطاقة "نص معتمد": نص المنشور حرفياً (منظّف بـ DOMPurify) مع مصدره (Assistant.dc.html). */
export function ApprovedTextCard({
  title,
  sectionName,
  html,
  sourceName,
  externalRef,
  readMoreHref,
  lang = "ar",
  langFallback,
  labels = AR_LABELS,
  headingLevel = "h2",
  actions,
  fallback,
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
  labels?: AnswerLabels;
  headingLevel?: "h2" | "h3";
  /** أزرار إضافية في التذييل بجانب «اقرأ المادة كاملة» (مثل «شارك المادة») */
  actions?: React.ReactNode;
  /** نص الخادم قبل التحميل (انظر SafeHtml) */
  fallback?: TextBlock[];
  className?: string;
}) {
  const dir = lang === "en" ? "ltr" : "rtl";
  const H = headingLevel;
  return (
    <article className={cn("overflow-hidden rounded-lg border border-approved-border bg-primary-50", className)} aria-label={labels.approvedHeader}>
      <header className="flex flex-wrap items-center justify-between gap-2 bg-primary-700 px-[18px] py-3 text-sm font-bold text-white">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden />
          {labels.approvedHeader}
        </span>
        {sectionName && (
          <span className="min-w-0 truncate font-medium" lang={lang} dir={dir}>
            {sectionName}
          </span>
        )}
      </header>
      <div className="flex flex-col gap-3 p-5" lang={lang} dir={dir}>
        {langFallback && <p className="rounded-sm bg-surface px-2.5 py-1.5 text-xs text-text-secondary">{labels.langFallbackNote}</p>}
        <H className="text-xl font-bold leading-[30px] text-primary-700">{title}</H>
        <SafeHtml html={html} fallback={fallback} className="text-[17px] leading-8" />
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-approved-border px-5 py-3.5 text-sm text-text-secondary">
        <span className="min-w-0">
          {labels.sourcePrefix}
          <span className="font-medium text-text">{sourceName || "—"}</span>
          {externalRef && (
            <>
              {" · "}
              <a href={externalRef} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary-600 hover:underline">
                {labels.originalLink}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </>
          )}
        </span>
        {(readMoreHref || actions) && (
          <span className="flex flex-wrap items-center gap-2">
            {actions}
            {readMoreHref && (
          <a
            href={readMoreHref}
            {...(isInternal(readMoreHref) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="inline-flex h-10 items-center rounded-[10px] border border-approved-border bg-surface px-4 font-bold text-primary-700 hover:bg-primary-100"
          >
            {labels.readFull}
          </a>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}

/** صورة المساعد: مربع primary-100 بأيقونة كتاب. */
export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-100 text-primary-600", className)} aria-hidden>
      <BookIcon className="size-[18px]" />
    </span>
  );
}

/** فقاعة توجيه المساعد: نص قصير فقط (صوت المساعد، لا محتوى). */
export function GuidanceBubble({
  text,
  lang = "ar",
  withAvatar = true,
  className,
}: {
  text: string;
  lang?: "ar" | "en";
  withAvatar?: boolean;
  className?: string;
}) {
  const bubble = (
    <p
      className="self-start rounded-lg border border-border bg-surface px-4 py-3 text-base leading-7 text-text"
      lang={lang}
      dir={lang === "en" ? "ltr" : "rtl"}
    >
      {text}
    </p>
  );
  if (!withAvatar) return <div className={cn("flex", className)}>{bubble}</div>;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <AssistantAvatar />
      {bubble}
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
          muted ? "bg-surface-muted text-text-secondary" : "bg-primary-100 text-primary-700",
        )}
      >
        {index}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{title}</span>
      {pct !== null && (
        <span className="flex shrink-0 items-center gap-1.5" aria-label={`${pct}%`}>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <span
              className={cn("block h-full rounded-full", muted ? "bg-text-muted" : "bg-primary-500")}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </span>
          <span className="w-8 text-xs tabular-nums text-text-secondary" dir="ltr">
            {pct}%
          </span>
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
  labels = AR_LABELS,
}: {
  message?: string;
  closest?: { title: string; similarity?: number | null; href?: string } | null;
  referrals: ReferralCenter[];
  className?: string;
  lang?: "ar" | "en";
  labels?: AnswerLabels;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-lg border border-border bg-surface-muted p-5", className)}>
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[17px] font-bold leading-7">{labels.fallbackTitle}</h2>
          {message && (
            <p className="text-[15px] leading-[26px] text-text-secondary" lang={lang} dir={lang === "en" ? "ltr" : "rtl"}>
              {message}
            </p>
          )}
        </div>
      </div>

      {closest && (
        <a
          href={closest.href}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3.5 text-text hover:border-approved-border"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{labels.closest}</span>
            <span className="text-base font-bold">{closest.title}</span>
          </span>
          <span className="shrink-0 text-sm font-bold text-primary-600">{labels.read}</span>
        </a>
      )}

      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-bold">{labels.centers}</span>
        {referrals.length === 0 ? (
          <p className="text-sm text-text-muted">{labels.noCenters}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
            {referrals.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded-md border border-border bg-surface px-4 py-3.5">
                <span className="text-[15px] font-bold">{c.name}</span>
                <span className="text-[13px] text-text-muted">
                  {c.country}
                  {c.country && c.url && " · "}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
                      {labels.visitSite}
                    </a>
                  )}
                </span>
                {c.contact && (
                  <span className="truncate text-[13px] text-text-secondary" dir="auto">
                    {c.contact}
                  </span>
                )}
              </div>
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
