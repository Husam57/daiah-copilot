"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * نموذج GET يعمل بلا JavaScript، ومع JavaScript: تغيير أي قائمة يطبّق الفلتر فوراً
 * (ويحذف المعاملات الفارغة من الرابط).
 */
export function FilterForm({ action, children, className, role }: { action: string; children: React.ReactNode; className?: string; role?: string }) {
  const router = useRouter();
  const ref = React.useRef<HTMLFormElement>(null);
  const submit = () => {
    const form = ref.current;
    if (!form) return;
    const qs = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string" && v.trim()) qs.set(k, v.trim());
    });
    const s = qs.toString();
    router.push(s ? `${action}?${s}` : action, { scroll: false });
  };
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      role={role}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") submit();
      }}
    >
      {children}
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  children,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        name={name}
        aria-label={label}
        defaultValue={defaultValue ?? ""}
        className="h-10 w-full appearance-none rounded-[10px] border border-border bg-surface pe-9 ps-3 text-sm text-text hover:border-border-strong focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
    </span>
  );
}
