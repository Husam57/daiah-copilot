import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-sm border border-border bg-surface text-sm text-text shadow-[inset_0_1px_0_rgba(16,24,20,0.02)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-text-muted hover:border-text-muted/50 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 px-3 py-2 leading-6", className)} {...props} />;
}

/** قائمة اختيار أصلية (أفضل على الجوال ولوحة المفاتيح) بتصميم موحد. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, "h-10 appearance-none pe-9 ps-3", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
    </div>
  );
}
