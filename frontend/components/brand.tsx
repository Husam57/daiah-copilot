import { BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** شعار المنصة: علامة بسيطة + الاسم (بلا زخارف في اللوحة). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-md bg-primary-600 text-white shadow-sm", className)}
      aria-hidden
    >
      <BookOpenCheck className="size-5" />
    </span>
  );
}

export function Brand({ subtitle, collapsed }: { subtitle?: string; collapsed?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-body font-extrabold text-primary-700">رفيق الداعية</span>
          {subtitle && <span className="block truncate text-xs text-text-muted">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
