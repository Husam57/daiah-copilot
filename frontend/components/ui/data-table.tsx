"use client";

import * as React from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./feedback";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** العمود الرئيسي: يظهر كعنوان البطاقة على الجوال */
  primary?: boolean;
  /** يُخفى في بطاقة الجوال */
  hideOnMobile?: boolean;
  /** عمود الإجراءات: في الجوال يظهر أسفل البطاقة */
  actions?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  skeletonRows?: number;
  caption?: string;
  className?: string;
}

/**
 * جدول بلا حدود عمودية، رأس surface-muted، صفوف بفاصل خفيف، Hover بخلفية bg.
 * أقل من md: يتحول إلى بطاقات.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  skeletonRows = 5,
  caption,
  className,
}: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actionsCol = columns.find((c) => c.actions);
  const rest = columns.filter((c) => c !== primary && !c.actions && !c.hideOnMobile);

  if (!loading && rows && rows.length === 0 && empty) {
    return <div className={cn("rounded-lg border border-border bg-surface", className)}>{empty}</div>;
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      {/* سطح المكتب */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-surface-muted">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-[18px] py-3 text-start text-sm font-bold text-text-secondary",
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="border-t border-border-subtle">
                    {columns.map((c) => (
                      <td key={c.key} className="px-[18px] py-3.5">
                        <Skeleton className={cn("h-4", c.primary ? "w-48" : "w-20")} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-t border-border-subtle transition-colors duration-150 hover:bg-bg",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn("px-[18px] py-3.5 align-middle", c.className)}
                        onClick={c.actions ? (e) => e.stopPropagation() : undefined}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* الجوال: بطاقات */}
      <ul className="divide-y divide-border-subtle md:hidden">
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 4) }, (_, i) => (
              <li key={i} className="space-y-2.5 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </li>
            ))
          : rows?.map((row) => (
              <li
                key={rowKey(row)}
                className={cn("p-4", onRowClick && "cursor-pointer active:bg-bg")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className="min-w-0">{primary.cell(row)}</div>
                {rest.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {rest.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-xs text-text-muted">{c.header}</dt>
                        <dd className="mt-0.5 min-w-0 text-sm">{c.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actionsCol && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                    {actionsCol.cell(row)}
                  </div>
                )}
              </li>
            ))}
      </ul>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="ترقيم الصفحات"
      className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary", className)}
    >
      <p>
        عرض {formatNumber(from)}–{formatNumber(to)} من {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="الصفحة السابقة"
        >
          السابق
        </Button>
        <span className="sr-only">
          الصفحة {formatNumber(page)} من {formatNumber(pages)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="الصفحة التالية"
        >
          التالي
        </Button>
      </div>
    </nav>
  );
}
