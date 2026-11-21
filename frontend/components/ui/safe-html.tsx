"use client";

import { Fragment, useMemo, useSyncExternalStore } from "react";
import type { TextBlock } from "@/lib/html-blocks";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** الكتل النصية قبل التحميل: نصوص مُهرَّبة عبر React فقط (عناصر القائمة المتتالية داخل <ul>). */
function Blocks({ blocks }: { blocks: TextBlock[] }) {
  const groups: (TextBlock | TextBlock[])[] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (b.tag === "li") {
      if (Array.isArray(last)) last.push(b);
      else groups.push([b]);
    } else groups.push(b);
  }
  return (
    <>
      {groups.map((g, i) => {
        if (Array.isArray(g)) {
          return (
            <ul key={i}>
              {g.map((li, j) => (
                <li key={j}>{li.text}</li>
              ))}
            </ul>
          );
        }
        const Tag = g.tag;
        const lines = g.text.split("\n");
        return (
          <Tag key={i} id={g.id}>
            {lines.map((ln, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {ln}
              </Fragment>
            ))}
          </Tag>
        );
      })}
    </>
  );
}

/**
 * يعرض HTML المنشور بعد تنظيفه بـ DOMPurify (منع XSS) — DOMPurify يعمل في المتصفح فقط.
 * fallback (اختياري): نفس النص ككتل نصية تُرسم في HTML الخادم وقبل التحميل، فيظهر النص فوراً
 * بتخطيط قريب، ثم يُستبدل بالـ HTML المنظّف. لا يُمرَّر أي HTML خام دون DOMPurify.
 */
export function SafeHtml({
  html,
  className,
  lang,
  dir,
  fallback,
}: {
  html: string | null | undefined;
  className?: string;
  lang?: string;
  dir?: "rtl" | "ltr";
  fallback?: TextBlock[];
}) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const clean = useMemo(() => (mounted ? sanitizeHtml(html) : ""), [html, mounted]);
  if (!mounted && fallback?.length) {
    return (
      <div key="ssr" lang={lang} dir={dir} className={cn("prose-content", className)}>
        <Blocks blocks={fallback} />
      </div>
    );
  }
  return (
    <div
      key="html"
      lang={lang}
      dir={dir}
      className={cn("prose-content", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
