"use client";

import { useMemo, useSyncExternalStore } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** يعرض HTML المنشور بعد تنظيفه بـ DOMPurify (منع XSS). يُعرض بعد التركيب في المتصفح فقط. */
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
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const clean = useMemo(() => (mounted ? sanitizeHtml(html) : ""), [html, mounted]);
  return (
    <div
      lang={lang}
      dir={dir}
      className={cn("prose-content", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
