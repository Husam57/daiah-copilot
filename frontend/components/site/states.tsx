"use client";

import { RotateCw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** حالة خطأ للموقع مع «إعادة المحاولة» (تعيد جلب بيانات الخادم). */
export function SiteError({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger">
        <XCircle className="size-6" aria-hidden />
      </span>
      <p className="font-bold">{t.common.loadError}</p>
      <p className="max-w-md text-sm text-text-secondary">{t.common.loadErrorHint}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => (onRetry ? onRetry() : start(() => router.refresh()))}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-bold hover:bg-primary-50 disabled:opacity-50"
      >
        <RotateCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
        {t.common.retry}
      </button>
    </div>
  );
}
