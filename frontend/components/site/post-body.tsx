"use client";

import { ApprovedTextCard } from "@/components/ui/answer";
import { SafeHtml } from "@/components/ui/safe-html";
import type { TextBlock } from "@/lib/html-blocks";
import { useI18n } from "@/lib/i18n/client";

/** نص المادة: HTML المنشور حرفياً بعد التنظيف بـ DOMPurify، بخط body-lg وعرض prose. */
export function PostBody({ html, lang, fallback }: { html: string; lang: "ar" | "en"; fallback?: TextBlock[] }) {
  return <SafeHtml html={html} fallback={fallback} lang={lang} dir={lang === "en" ? "ltr" : "rtl"} className="prose-reading max-w-[680px] text-body-lg" />;
}

/** صفحة الشبهة: الرد المعتمد داخل ApprovedTextCard. */
export function ShubhaResponse({
  title,
  html,
  lang,
  sectionName,
  sourceName,
  externalRef,
  fallback,
}: {
  title: string;
  html: string;
  lang: "ar" | "en";
  sectionName?: string | null;
  sourceName?: string | null;
  externalRef?: string | null;
  fallback?: TextBlock[];
}) {
  const { t } = useI18n();
  return (
    <ApprovedTextCard
      className="max-w-[720px]"
      title={title}
      html={html}
      lang={lang}
      sectionName={sectionName}
      sourceName={sourceName}
      externalRef={externalRef}
      fallback={fallback}
      labels={{ ...t.assistant, read: t.common.read }}
    />
  );
}
