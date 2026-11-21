"use client";

import { Link2, Share2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** ينسخ رابط المادة (للمشاركة). variant=icon زر 40px بأيقونة مشاركة (IntroMaterials)،
 * و share زر «شارك المادة» (صفحة المادة وبطاقة النص المعتمد). على الجوال: مشاركة النظام إن توفرت. */
export function CopyLinkButton({
  path,
  variant = "full",
  className,
  title,
}: {
  path: string;
  variant?: "full" | "icon" | "share";
  className?: string;
  /** عنوان المادة لمشاركة النظام */
  title?: string;
}) {
  const { t } = useI18n();
  const copy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share && variant !== "full" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title });
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
  if (variant === "share") {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={t.common.copyLinkShare}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-sm font-bold text-primary-700 hover:bg-primary-50",
          className,
        )}
      >
        <Share2 className="size-4" aria-hidden />
        {t.common.sharePost}
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
