"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** يُرسل الرابط إلى /assistant?q=... فيُرسل السؤال تلقائياً هناك. */
export function assistantHref(q: string) {
  return `/assistant?q=${encodeURIComponent(q.trim())}`;
}

/** حقل السؤال الكبير في الـ Hero + الأسئلة المقترحة (Main.dc.html). */
export function HeroAsk() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (text: string) => {
    if (text.trim()) router.push(assistantHref(text));
  };
  return (
    <form
      className="mt-2 flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <label htmlFor="hero-q" className="text-sm font-bold">
        {t.home.askLabel}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-md focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
        <input
          id="hero-q"
          type="text"
          value={q}
          maxLength={1000}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.home.askPlaceholder}
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[17px] outline-none placeholder:text-text-muted"
          enterKeyHint="send"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-md bg-primary-700 px-[22px] text-base font-bold text-white transition-colors hover:bg-primary-600"
        >
          {t.home.ask}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {t.home.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="min-h-10 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-text-secondary transition-colors hover:border-approved-border hover:text-primary-700"
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}
