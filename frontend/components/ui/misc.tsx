"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "./controls";

/* ---------- PageHeader ---------- */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-h1-mobile text-text md:text-h1">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-body text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- TagsInput (Chips) ---------- */
export function TagsInput({
  id,
  value,
  onChange,
  placeholder = "اكتب ثم اضغط Enter",
  max = 20,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const parts = raw
      .split(/[,،]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  };

  return (
    <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1.5 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-sm bg-primary-100 py-0.5 pe-1 ps-2 text-xs font-medium text-primary-700"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="grid size-5 place-items-center rounded-sm hover:bg-primary-500/15"
            aria-label={`إزالة الوسم ${t}`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,،]$/.test(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-text-muted"
      />
    </div>
  );
}

/* ---------- LanguageSwitch ---------- */
/**
 * العربية | English. applyToDocument=true يغيّر dir و lang على <html> (للموقع العام).
 * بدونها يتحكم فقط في المحتوى المحلي (مثل تبويبات المحرر).
 */
export function LanguageSwitch({
  value,
  onChange,
  applyToDocument,
  size,
  className,
}: {
  value: "ar" | "en";
  onChange: (lang: "ar" | "en") => void;
  applyToDocument?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Segmented
      label="اللغة"
      value={value}
      size={size}
      className={className}
      onChange={(lang) => {
        if (applyToDocument) {
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        }
        onChange(lang);
      }}
      options={[
        { value: "ar", label: "العربية", lang: "ar" },
        { value: "en", label: "English", lang: "en" },
      ]}
    />
  );
}

/* ---------- Kbd ---------- */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="ltr"
      className="inline-flex h-5 items-center rounded-[4px] border border-border bg-surface px-1.5 font-en text-[11px] font-medium text-text-muted"
    >
      {children}
    </kbd>
  );
}
