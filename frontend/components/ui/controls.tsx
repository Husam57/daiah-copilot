"use client";

import { Slider as S, Switch as SW, Tabs as TB } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------- Tabs ---------- */
export const Tabs = TB.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TB.List>) {
  return <TB.List className={cn("flex items-center gap-1 border-b border-border", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TB.Trigger>) {
  return (
    <TB.Trigger
      className={cn(
        "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 data-[state=active]:border-primary-600 data-[state=active]:text-primary-700 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TB.Content>) {
  return <TB.Content className={cn("outline-none", className)} {...props} />;
}

/* ---------- Slider ---------- */
export function Slider({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root className={cn("relative flex h-6 w-full touch-none select-none items-center", className)} {...props}>
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-muted ring-1 ring-border">
        <S.Range className="absolute h-full bg-primary-600" />
      </S.Track>
      <S.Thumb
        className="block size-5 rounded-full border-2 border-primary-600 bg-surface shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
        aria-label={props["aria-label"]}
      />
    </S.Root>
  );
}

/* ---------- Switch ---------- */
export function Switch({ className, ...props }: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 data-[state=checked]:bg-primary-600",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5" />
    </SW.Root>
  );
}

/* ---------- Segmented (تبديل بين خيارات قليلة) ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; lang?: string; icon?: React.ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center rounded-md border border-border bg-surface-muted p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-500 [&_svg]:size-4",
              size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
              active ? "bg-surface text-primary-700 shadow-sm" : "text-text-secondary hover:text-text",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
