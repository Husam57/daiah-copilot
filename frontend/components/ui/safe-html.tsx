"use client";

import { useMemo } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * يعرض HTML المنشور بعد تنظيفه بـ DOMPurify (منع XSS). التنظيف يعمل في الخادم والمتصفح
 * (isomorphic-dompurify)، فالنص كاملاً في HTML الخادم. لا يُمرَّر أي HTML خام دون تنظيف.
 */
export function SafeHtml({
  html,
  className,
  lang,
  dir,
}: {
  html: string | null | undefined;
  className?: string;
  lang?: string;
  dir?: "rtl" | "ltr";
}) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div
      lang={lang}
      dir={dir}
      className={cn("prose-content", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
