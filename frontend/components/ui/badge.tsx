import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheck, Clock, Database, FilePen, RefreshCw, Send } from "lucide-react";
import * as React from "react";
import { INDEX_STATE_LABELS, STATUS_LABELS } from "@/lib/format";
import type { IndexState, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-secondary",
        primary: "bg-primary-100 text-primary-700",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning-fg",
        danger: "bg-danger-bg text-danger",
        info: "bg-info-bg text-info",
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
const STATUS_ICON = { draft: FilePen, review: Send, published: BadgeCheck } as const;

/** شارة حالة المنشور: مسودة (info) · قيد المراجعة (warning) · منشور (success). */
export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** شارة الفهرسة: مفهرس (success + قاعدة بيانات) · بانتظار الفهرسة / يحتاج تحديث (warning). */
export function IndexBadge({ state, className }: { state: IndexState | "none"; className?: string }) {
  if (state === "none") {
    return (
      <Badge variant="neutral" className={className}>
        {INDEX_STATE_LABELS.none}
      </Badge>
    );
  }
  const Icon = state === "indexed" ? Database : state === "stale" ? RefreshCw : Clock;
  return (
    <Badge variant={state === "indexed" ? "success" : "warning"} className={className}>
      <Icon aria-hidden />
      {INDEX_STATE_LABELS[state]}
    </Badge>
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
