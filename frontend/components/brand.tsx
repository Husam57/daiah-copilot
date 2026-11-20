import { cn } from "@/lib/utils";

/** أيقونة الكتاب المفتوح (من التصميم المعتمد). */
export function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/** علامة المنصة: مربع primary-700 بزاوية 9px وأيقونة كتاب بيضاء. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-primary-700 text-white", className)}
      aria-hidden
    >
      <BookIcon className="size-[18px]" />
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[17px] font-extrabold leading-6 text-primary-700">رفيق الداعية</span>
        {subtitle && <span className="truncate text-xs text-text-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
