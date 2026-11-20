import { Check } from "lucide-react";
import * as React from "react";
import type { HealthState, IndexState, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "./feedback";

/* ---------- StatusDot ---------- */
const DOT = {
  ok: { color: "bg-success", ring: "ring-success/20", label: "متصل" },
  warning: { color: "bg-warning", ring: "ring-warning/20", label: "يحتاج تحديث" },
  down: { color: "bg-danger", ring: "ring-danger/20", label: "غير متصل" },
  unknown: { color: "bg-text-muted", ring: "ring-text-muted/20", label: "غير معروف" },
} as const;

/** نقطة 8px + نص دائماً (لا يُعتمد على اللون وحده). */
export function StatusDot({
  state,
  label,
  className,
}: {
  state: HealthState | "unknown";
  label?: React.ReactNode;
  className?: string;
}) {
  const d = DOT[state];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className={cn("size-2 shrink-0 rounded-full ring-4", d.color, d.ring)} aria-hidden />
      <span>{label ?? d.label}</span>
    </span>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({
  icon,
  label,
  value,
  hint,
  change,
  highlight,
  loading,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  change?: { value: string; positive?: boolean };
  /** رقم مميز باللون accent (بحذر) */
  highlight?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-100 text-primary-600 [&_svg]:size-5">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-secondary">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className={cn("mt-0.5 text-h2", highlight ? "text-accent-600" : "text-text")}>{value}</p>
          )}
          {(hint || change) && !loading && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              {change && (
                <span className={change.positive ? "text-success" : "text-danger"}>{change.value}</span>
              )}
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Stepper (سير العمل) ---------- */
const STEPS = [
  { key: "draft", label: "مسودة" },
  { key: "review", label: "قيد المراجعة" },
  { key: "published", label: "منشور" },
  { key: "indexed", label: "مفهرس" },
] as const;

/** مسودة ← قيد المراجعة ← منشور ← مفهرس. الحالية ممتلئة، المكتملة بعلامة صح. */
export function Stepper({
  status,
  indexState,
  className,
}: {
  status: PostStatus;
  indexState?: IndexState | "none";
  className?: string;
}) {
  const current = status === "draft" ? 0 : status === "review" ? 1 : indexState === "indexed" ? 3 : 2;
  const allDone = status === "published" && indexState === "indexed";
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="مراحل سير العمل">
      {STEPS.map((s, i) => {
        const done = i < current || (allDone && i === current);
        const active = i === current && !allDone;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.5 h-0.5 -translate-y-1/2",
                  i <= current ? "bg-primary-600" : "bg-border",
                )}
                style={{ insetInlineEnd: "50%", marginInlineEnd: "14px", width: "calc(100% - 28px)" }}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-bold",
                done && "border-primary-600 bg-primary-600 text-white",
                active && "border-primary-600 bg-primary-600 text-white ring-4 ring-primary-100",
                !done && !active && "border-border bg-surface text-text-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "mt-1.5 text-xs leading-4",
                active ? "font-bold text-primary-700" : done ? "text-text" : "text-text-muted",
              )}
            >
              {s.label}
              {done && <span className="sr-only"> (مكتملة)</span>}
              {active && <span className="sr-only"> (الحالية)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
