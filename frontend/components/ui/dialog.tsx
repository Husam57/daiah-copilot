"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = "fixed inset-0 z-50 bg-text/30 backdrop-blur-[1px] data-[state=open]:animate-fade-in";

/** نافذة في المنتصف (زوايا xl + shadow-lg). */
export function DialogContent({
  title,
  description,
  children,
  className,
  footer,
  size = "md",
  hideClose,
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  hideClose?: boolean;
} & Omit<React.ComponentProps<typeof D.Content>, "title">) {
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
        <D.Content
          className={cn(
            "pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none data-[state=open]:animate-pop-in",
            width,
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="min-w-0">
              <D.Title className="text-h3 text-text">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm font-normal text-text-secondary">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : "نافذة"}</D.Description>
              )}
            </div>
            {!hideClose && (
              <D.Close
                className="-me-2 grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                aria-label="إغلاق"
              >
                <X className="size-4" aria-hidden />
              </D.Close>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted/50 px-6 py-3">
              {footer}
            </div>
          )}
        </D.Content>
      </div>
    </D.Portal>
  );
}

/** Sheet جانبي يخرج من جهة النهاية (اليسار في العربية) — للنماذج. */
export function SheetContent({
  title,
  description,
  children,
  footer,
  className,
  side = "end",
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  side?: "start" | "end";
} & Omit<React.ComponentProps<typeof D.Content>, "title">) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-md flex-col border-border bg-surface shadow-lg outline-none",
          side === "end"
            ? "end-0 border-s data-[state=open]:animate-sheet-in"
            : "start-0 border-e data-[state=open]:animate-drawer-in",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-h3 text-text">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm font-normal text-text-secondary">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "لوحة جانبية"}</D.Description>
            )}
          </div>
          <D.Close
            className="-me-2 grid size-9 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            aria-label="إغلاق"
          >
            <X className="size-4" aria-hidden />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted/50 px-5 py-3">
            {footer}
          </div>
        )}
      </D.Content>
    </D.Portal>
  );
}
