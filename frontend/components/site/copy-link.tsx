"use client";

import { Link2, Share2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** ينسخ رابط المادة (للمشاركة). variant=icon زر 40px بأيقونة مشاركة (IntroMaterials). */
export function CopyLinkButton({ path, variant = "full", className }: { path: string; variant?: "full" | "icon"; className?: string }) {
  const { t } = useI18n();
  const copy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share && variant === "icon" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t.common.copied);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error(t.common.copyFailed);
    }
  };
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={t.common.copyLinkShare}
        title={t.common.copyLinkShare}
        className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-[10px] border border-border bg-surface hover:bg-primary-50", className)}
      >
        <Share2 className="size-[17px]" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn("flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-bold hover:bg-primary-50", className)}
    >
      <Link2 className="size-4" aria-hidden />
      {t.common.copyLink}
    </button>
  );
}
