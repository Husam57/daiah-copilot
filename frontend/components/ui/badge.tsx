import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheck } from "lucide-react";
import * as React from "react";
import { INDEX_STATE_LABELS, STATUS_LABELS } from "@/lib/format";
import type { IndexState, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-bold leading-4 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-secondary",
        primary: "bg-primary-100 text-primary-700",
        success: "bg-success-bg text-success-fg",
        warning: "bg-warning-bg text-warning-fg",
        danger: "bg-danger-bg text-danger-fg",
        info: "bg-info-bg text-info-fg",
        accent: "bg-accent-100 text-accent-fg",
        outline: "border border-border bg-surface text-text-secondary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT = { draft: "info", review: "warning", published: "success" } as const;

/** شارة حالة المنشور: مسودة (info) · قيد المراجعة (warning) · منشور (success). */
export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const INDEX_TONE = {
  indexed: { dot: "bg-success", ink: "text-success-fg", variant: "success" },
  pending: { dot: "bg-warning", ink: "text-warning-fg", variant: "warning" },
  stale: { dot: "bg-warning", ink: "text-warning-fg", variant: "warning" },
  none: { dot: "bg-text-disabled", ink: "text-text-muted", variant: "neutral" },
} as const;

/**
 * حالة الفهرسة: نقطة + نص (في الجداول)، أو pill=true شارة بخلفية (في المحرر).
 * مفهرس (success) · بانتظار الفهرسة / يحتاج تحديث (warning) · غير مفهرس (محايد).
 */
export function IndexBadge({
  state,
  pill,
  className,
}: {
  state: IndexState | "none";
  pill?: boolean;
  className?: string;
}) {
  const t = INDEX_TONE[state];
  const dot = <span className={cn("size-2 shrink-0 rounded-full", t.dot)} aria-hidden />;
  if (pill) {
    return (
      <Badge variant={t.variant} className={className}>
        {dot}
        {INDEX_STATE_LABELS[state]}
      </Badge>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", t.ink, className)}>
      {dot}
      {INDEX_STATE_LABELS[state]}
    </span>
  );
}

/** شارة "موثق" — اللون المميز يُستخدم هنا بحذر. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="accent" className={className}>
      <BadgeCheck aria-hidden />
      موثق
    </Badge>
  );
}
