"use client";

import { AlertTriangle } from "lucide-react";
import { AlertDialog as A } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** يظهر في زر التأكيد: حذف «الاسم» */
  itemName?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

/** تأكيد لكل حذف أو عملية ثقيلة. زر الحذف danger ويذكر اسم العنصر. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  confirmLabel,
  variant = "danger",
  loading,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const label = confirmLabel ?? (itemName ? `حذف «${itemName}»` : "حذف");
  return (
    <A.Root open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-text/30 data-[state=open]:animate-fade-in" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <A.Content className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg outline-none data-[state=open]:animate-pop-in">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full",
                  variant === "danger" ? "bg-danger-bg text-danger" : "bg-primary-100 text-primary-600",
                )}
              >
                <AlertTriangle className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <A.Title className="text-h3 text-text">{title}</A.Title>
                <A.Description asChild>
                  <div className="mt-1.5 text-sm font-normal text-text-secondary">
                    {description ?? "لا يمكن التراجع عن هذه العملية."}
                  </div>
                </A.Description>
                {children}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <A.Cancel asChild>
                <Button variant="secondary" disabled={loading}>
                  إلغاء
                </Button>
              </A.Cancel>
              <Button
                variant={variant}
                loading={loading}
                onClick={async (e) => {
                  e.preventDefault();
                  await onConfirm();
                }}
                className="max-w-full truncate"
              >
                {label}
              </Button>
            </div>
          </A.Content>
        </div>
      </A.Portal>
    </A.Root>
  );
}
