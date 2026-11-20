import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { DICTIONARIES, fmtNumber, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/** ترقيم صفحات بالروابط (Library.dc.html): مربعات 40px، الحالية ممتلئة. */
export function Pager({
  page,
  total,
  pageSize,
  hrefFor,
  locale,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (p: number) => string;
  locale: Locale;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const t = DICTIONARIES[locale];
  // نافذة صفحات حول الحالية
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const box = "grid size-10 place-items-center rounded-[10px] text-sm";
  return (
    <nav aria-label={t.common.pagination} className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={cn(box, "border border-border bg-surface hover:bg-primary-50")} aria-label={t.common.prev}>
          <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      )}
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className={cn(box, "text-text-muted")} aria-hidden>
            …
          </span>
        ) : n === page ? (
          <span key={n} aria-current="page" className={cn(box, "bg-primary-700 font-bold text-white")}>
            {fmtNumber(n, locale)}
          </span>
        ) : (
          <Link key={n} href={hrefFor(n)} className={cn(box, "border border-border bg-surface text-text hover:bg-primary-50")} aria-label={`${t.common.page} ${n}`}>
            {fmtNumber(n, locale)}
          </Link>
        ),
      )}
      {page < pages && (
        <Link href={hrefFor(page + 1)} className={cn(box, "border border-border bg-surface hover:bg-primary-50")} aria-label={t.common.next}>
          <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
