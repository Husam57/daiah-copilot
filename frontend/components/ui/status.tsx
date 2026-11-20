import { Check } from "lucide-react";
import * as React from "react";
import { formatNumber } from "@/lib/format";
import type { HealthState, IndexState, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "./feedback";

/* ---------- StatusDot ---------- */
const DOT = {
  ok: { dot: "bg-success", ink: "text-success-fg", label: "متصل" },
  warning: { dot: "bg-warning", ink: "text-warning-fg", label: "يحتاج تحديث" },
  down: { dot: "bg-danger", ink: "text-danger-fg", label: "غير متصل" },
  unknown: { dot: "bg-text-disabled", ink: "text-text-muted", label: "غير معروف" },
} as const;

/** نقطة 8px + نص بلون الحالة (لا يُعتمد على اللون وحده). */
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
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-bold", d.ink, className)}>
      <span className={cn("size-2 shrink-0 rounded-full", d.dot)} aria-hidden />
      <span>{label ?? d.label}</span>
    </span>
  );
}

/* ---------- StatCard ---------- */
const TONES = {
  primary: "bg-primary-100 text-primary-700",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
  danger: "bg-danger-bg text-danger-fg",
} as const;

/** بطاقة إحصاء: أيقونة في دائرة ملونة، الرقم 26px، ثم التسمية. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  change,
  tone = "primary",
  highlight,
  loading,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  change?: { value: string; positive?: boolean };
  tone?: keyof typeof TONES;
  /** رقم مميز باللون accent (بحذر) */
  highlight?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-border bg-surface p-[18px]", className)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-[19px]", TONES[tone])}>
        {icon}
      </span>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className={cn("text-[26px] font-extrabold leading-8", highlight ? "text-accent-600" : "text-text")}>
          {value}
        </span>
      )}
      <span className="text-sm text-text-secondary">
        {label}
        {(hint || change) && !loading && (
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {change && <span className={change.positive ? "text-success-fg" : "text-danger-fg"}>{change.value}</span>}
            {hint}
          </span>
        )}
      </span>
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

/** لون الخطوة الحالية حسب الحالة: مسودة (info) · مراجعة/بانتظار الفهرسة (warning). */
const CURRENT_TONE = ["bg-info text-info-fg", "bg-warning text-warning-fg", "bg-success text-success-fg", "bg-warning text-warning-fg"];

/**
 * مسودة ← قيد المراجعة ← منشور ← مفهرس، أفقياً في سطر واحد:
 * المكتملة دائرة خضراء بعلامة صح، الحالية ممتلئة بلون الحالة، القادمة بحد رمادي.
 */
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
  // منشور وغير مفهرس: الحالية هي «مفهرس» (بانتظار الفهرسة)
  const active = status === "published" && !allDone ? 3 : current;
  return (
    <ol
      className={cn("m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[13px] font-bold", className)}
      aria-label="مراحل المنشور"
    >
      {STEPS.map((s, i) => {
        const done = allDone || i < active;
        const isActive = i === active && !allDone;
        const [bg, ink] = CURRENT_TONE[i].split(" ");
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <li aria-hidden className={cn("h-0.5 w-6", i <= active || allDone ? "bg-success" : "bg-border")} />
            )}
            <li
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                done ? "text-success-fg" : isActive ? ink : "text-text-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-[22px] place-items-center rounded-full text-xs",
                  done && "bg-success text-white",
                  isActive && `${bg} text-white`,
                  !done && !isActive && "border-2 border-border-strong",
                )}
              >
                {done ? <Check className="size-[13px]" strokeWidth={3} aria-hidden /> : formatNumber(i + 1)}
              </span>
              {s.label}
              {done && <span className="sr-only"> (مكتملة)</span>}
              {isActive && <span className="sr-only"> (الحالية)</span>}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
