import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  /** يجب أن يطابق id الحقل الداخلي */
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  /** يُلحق «(اختياري)» بالتسمية */
  optional?: boolean;
  /** عنصر بجانب التسمية (عدّاد أحرف مثلاً) */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** تسمية فوق الحقل، تلميح تحته، ورسالة خطأ حمراء مع أيقونة. */
export function Field({ id, label, hint, error, required, optional, aside, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const child = React.isValidElement<Record<string, unknown>>(children)
    ? React.cloneElement(children, {
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-text">
          {label}
          {optional && <span className="ms-1 font-medium text-text-muted">(اختياري)</span>}
          {required && (
            <span className="ms-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {child}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs text-danger" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
