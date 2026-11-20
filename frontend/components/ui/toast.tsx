"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

/** Toast أسفل الشاشة على جهة البداية (اليمين في العربية): نجاح / خطأ / معلومة / تحذير. */
export function Toaster() {
  return (
    <Sonner
      dir="rtl"
      position="bottom-right"
      closeButton
      duration={4500}
      icons={{
        success: <CheckCircle2 className="size-5 text-success" aria-hidden />,
        error: <XCircle className="size-5 text-danger" aria-hidden />,
        info: <Info className="size-5 text-info" aria-hidden />,
        warning: <AlertTriangle className="size-5 text-warning" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-border !bg-surface !text-text !shadow-md !font-sans !gap-3 !items-start",
          title: "!text-sm !font-bold",
          description: "!text-sm !font-normal !text-text-secondary",
          closeButton: "!border-border !bg-surface !text-text-muted",
        },
      }}
    />
  );
}

export { toast };
