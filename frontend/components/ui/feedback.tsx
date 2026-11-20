import { AlertTriangle, CheckCircle2, Info, RotateCw, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/* ---------- Skeleton ---------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-surface-muted", className)} {...props} />;
}

/** بطاقة هيكلية جاهزة */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-5 shadow-sm", className)} aria-hidden>
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-surface-muted text-text-muted [&_svg]:size-8">
        {icon}
      </div>
      <p className="text-body font-bold text-text">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm font-normal text-text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- ErrorState ---------- */
export function ErrorState({
  message,
  onRetry,
  className,
  compact,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger">
        <XCircle className="size-6" aria-hidden />
      </div>
      <div>
        <p className="font-bold text-text">تعذّر تحميل البيانات</p>
        <p className="mt-1 max-w-md text-sm font-normal text-text-secondary">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

/* ---------- Alert ---------- */
const ALERT_STYLES = {
  info: { box: "border-info/20 bg-info-bg text-info", Icon: Info },
  success: { box: "border-success/20 bg-success-bg text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning/25 bg-warning-bg text-warning-fg", Icon: AlertTriangle },
  danger: { box: "border-danger/20 bg-danger-bg text-danger", Icon: XCircle },
} as const;

export function Alert({
  variant = "info",
  title,
  children,
  className,
  icon,
}: {
  variant?: keyof typeof ALERT_STYLES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  const { box, Icon } = ALERT_STYLES[variant];
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm", box, className)}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Icon aria-hidden />}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn("font-normal text-text", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Progress ---------- */
export function ProgressBar({ value, className, label }: { value?: number; className?: string; label: string }) {
  const indeterminate = value === undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary-600 transition-[width] duration-200 ease-out",
          indeterminate && "w-2/5 animate-indeterminate",
        )}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
