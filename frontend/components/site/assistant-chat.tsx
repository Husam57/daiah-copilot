"use client";

import { Info, Layers, RotateCcw, SquarePen, ThumbsDown, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { ApprovedTextCard, AssistantAvatar, FallbackCard } from "@/components/ui/answer";
import { Skeleton } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n/client";
import { fmtNumber, type Dict } from "@/lib/i18n/dictionaries";
import { postHref } from "@/lib/site";
import { SiteApiError, siteFetch } from "@/lib/site-api";
import type { ChatResponse, SourceBrief } from "@/lib/types";
import { cn } from "@/lib/utils";

const SESSION_KEY = "daiah.chat.session";
const LANG_KEY = "daiah.chat.lang";
const HISTORY_KEY = "daiah.chat.history";
const MAX = 1000;

type Lang = "ar" | "en";
interface Turn {
  id: string;
  question: string;
  lang: Lang;
  status: "loading" | "done" | "error";
  response?: ChatResponse;
  error?: string;
  feedback?: "up" | "down";
}

function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function sessionId(): string {
  const s = store("local");
  let id = s?.getItem(SESSION_KEY) ?? null;
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    s?.setItem(SESSION_KEY, id);
  }
  return id;
}

function errorText(e: unknown, t: Dict): string {
  if (e instanceof SiteApiError) {
    if (e.status === 429) return e.retryAfter ? t.assistant.rateLimitedIn(String(e.retryAfter)) : t.assistant.rateLimited;
    if (e.status === 422) return t.assistant.invalid;
    if (e.status === 0) return t.assistant.network;
  }
  return t.assistant.unavailable;
}

const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

/** المساعد (Assistant.dc.html): المحادثة + لوحة «المصادر المسترجعة» (Bottom Sheet على الجوال). */
export function AssistantChat() {
  const { t, locale } = useI18n();
  const labels = React.useMemo(() => ({ ...t.assistant, read: t.common.read }), [t]);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [lang, setLang] = React.useState<Lang>(locale);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const busy = turns.some((x) => x.status === "loading");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const autoSent = React.useRef(false);

  // استعادة المحادثة (لهذه النافذة) ولغة المادة المفضلة
  React.useEffect(() => {
    try {
      const saved = JSON.parse(store("session")?.getItem(HISTORY_KEY) ?? "[]") as Turn[];
      if (Array.isArray(saved)) setTurns(saved.filter((x) => x.status !== "loading").slice(-20));
    } catch {
      /* تجاهل */
    }
    const l = store("local")?.getItem(LANG_KEY);
    if (l === "ar" || l === "en") setLang(l);
    setRestored(true);
  }, []);

  React.useEffect(() => {
    if (!restored) return;
    try {
      store("session")?.setItem(HISTORY_KEY, JSON.stringify(turns.filter((x) => x.status !== "loading").slice(-20)));
    } catch {
      /* تجاهل */
    }
  }, [turns, restored]);

  const ask = React.useCallback(
    async (question: string, l: Lang, retryId?: string) => {
      const text = question.trim();
      if (!text) return;
      const id = retryId ?? `t${Date.now()}`;
      setTurns((prev) =>
        retryId
          ? prev.map((x) => (x.id === id ? { ...x, status: "loading", error: undefined } : x))
          : [...prev, { id, question: text, lang: l, status: "loading" }],
      );
      setSelected(id);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
      try {
        const response = await siteFetch<ChatResponse>("/api/chat", {
          method: "POST",
          body: { message: text.slice(0, MAX), lang: l, session_id: sessionId() },
        });
        setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, status: "done", response } : x)));
      } catch (e) {
        setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, status: "error", error: errorText(e, t) } : x)));
      }
    },
    [t],
  );

  // سؤال قادم من الرئيسية/المكتبة (?q=) يُرسل تلقائياً مرة واحدة، ثم يُحذف من الرابط
  React.useEffect(() => {
    if (!restored || autoSent.current) return;
    const q = params.get("q");
    if (!q) return;
    autoSent.current = true;
    const l = (params.get("lang") === "en" ? "en" : params.get("lang") === "ar" ? "ar" : null) ?? lang;
    void ask(q, l);
    router.replace(pathname, { scroll: false });
  }, [restored, params, ask, lang, router, pathname]);

  const submit = () => {
    if (busy || !input.trim()) return;
    void ask(input, lang);
    setInput("");
  };

  const setMaterialLang = (l: Lang) => {
    setLang(l);
    store("local")?.setItem(LANG_KEY, l);
  };

  const feedback = async (turn: Turn, helpful: boolean) => {
    if (!turn.response || turn.feedback) return;
    setTurns((prev) => prev.map((x) => (x.id === turn.id ? { ...x, feedback: helpful ? "up" : "down" } : x)));
    try {
      await siteFetch("/api/chat/feedback", { method: "POST", body: { log_id: turn.response.log_id, helpful } });
    } catch {
      setTurns((prev) => prev.map((x) => (x.id === turn.id ? { ...x, feedback: undefined } : x)));
    }
  };

  const done = turns.filter((x) => x.status === "done");
  const current = turns.find((x) => x.id === selected && x.status !== "error") ?? done[done.length - 1];
  const currentIndex = current ? turns.indexOf(current) + 1 : 0;

  const sources = (
    <SourcesPanel
      turn={current}
      index={currentIndex}
      t={t}
      locale={locale}
    />
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-6 px-4 pb-16 pt-6 md:px-8 md:pt-8">
      <section aria-label={t.assistant.conversation} className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-bold leading-10">{t.assistant.title}</h1>
            <p className="text-[15px] text-text-secondary">{t.assistant.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-bold lg:hidden"
            >
              <Layers className="size-4" aria-hidden />
              {t.assistant.showSources}
            </button>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurns([]);
                  setSelected(null);
                  inputRef.current?.focus();
                }}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-bold text-text-secondary hover:bg-surface-muted disabled:opacity-50"
              >
                <SquarePen className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t.assistant.newChat}</span>
                <span className="sr-only sm:hidden">{t.assistant.newChat}</span>
              </button>
            )}
          </div>
        </div>

        <div role="log" aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-5">
          {turns.length === 0 && (
            <div className="flex items-start gap-3">
              <AssistantAvatar />
              <div className="flex min-w-0 flex-col gap-3">
                <p className="rounded-lg border border-border bg-surface px-4 py-3 text-base leading-7">{t.assistant.welcome}</p>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-text-muted">{t.assistant.examples}</span>
                  <div className="flex flex-wrap gap-2">
                    {t.home.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void ask(s, lang)}
                        className="min-h-10 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-text-secondary hover:border-approved-border hover:text-primary-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <React.Fragment key={turn.id}>
              <div className="max-w-[85%] self-start whitespace-pre-line rounded-[18px] bg-primary-700 px-[18px] py-3.5 text-base leading-7 text-white sm:max-w-[75%]" dir="auto">
                <span className="sr-only">{t.assistant.you}: </span>
                {turn.question}
              </div>
              <div
                className={cn(
                  "flex w-full max-w-[760px] items-start gap-3 self-end rounded-xl transition-shadow",
                  turn.id === current?.id && done.length > 1 && "lg:ring-2 lg:ring-primary-100 lg:ring-offset-4 lg:ring-offset-bg",
                )}
                onClick={() => turn.status === "done" && setSelected(turn.id)}
              >
                <AssistantAvatar />
                <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                  <span className="sr-only">{t.assistant.bot}:</span>
                  {turn.status === "loading" ? (
                    <div className="flex flex-col gap-3.5" aria-busy="true">
                      <p className="self-start rounded-lg border border-border bg-surface px-4 py-3 text-base text-text-secondary">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2 animate-pulse rounded-full bg-primary-500" aria-hidden />
                          {t.assistant.searching}
                        </span>
                      </p>
                      <div className="overflow-hidden rounded-lg border border-approved-border bg-primary-50" aria-hidden>
                        <div className="h-11 bg-primary-700/90" />
                        <div className="flex flex-col gap-3 p-5">
                          <Skeleton className="h-6 w-1/2 bg-[#D9E8E4]" />
                          <Skeleton className="h-2.5 w-full bg-[#D9E8E4]" />
                          <Skeleton className="h-2.5 w-[96%] bg-[#D9E8E4]" />
                          <Skeleton className="h-2.5 w-[88%] bg-[#D9E8E4]" />
                          <Skeleton className="h-2.5 w-[62%] bg-[#D9E8E4]" />
                        </div>
                      </div>
                    </div>
                  ) : turn.status === "error" ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger-fg">
                      <span className="inline-flex items-start gap-2">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {turn.error}
                      </span>
                      <button
                        type="button"
                        onClick={() => void ask(turn.question, turn.lang, turn.id)}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-danger/30 bg-surface px-3 font-bold text-danger-fg disabled:opacity-50"
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        {t.assistant.retry}
                      </button>
                    </div>
                  ) : turn.response?.type === "match" ? (
                    <>
                      <p className="self-start rounded-lg border border-border bg-surface px-4 py-3 text-base leading-7" dir="auto">
                        {turn.response.guidance}
                      </p>
                      <ApprovedTextCard
                        title={turn.response.post.title}
                        sectionName={turn.response.post.section}
                        html={turn.response.post.content}
                        sourceName={turn.response.post.source_name}
                        externalRef={turn.response.post.external_ref}
                        lang={turn.response.post.lang}
                        langFallback={turn.response.post.lang_fallback}
                        readMoreHref={`${postHref(turn.response.post.slug)}${turn.response.post.lang === "en" ? "?lang=en" : ""}`}
                        labels={labels}
                      />
                      {turn.response.related.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] text-text-muted">{t.assistant.related}</span>
                          {turn.response.related.map((r) => (
                            <Link
                              key={r.post_id}
                              href={postHref(r.slug)}
                              className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text hover:border-approved-border"
                            >
                              {r.title}
                            </Link>
                          ))}
                        </div>
                      )}
                      <Feedback turn={turn} t={t} onRate={(h) => void feedback(turn, h)} />
                    </>
                  ) : turn.response ? (
                    <>
                      <FallbackCard
                        message={turn.response.message}
                        lang={/[؀-ۿ]/.test(turn.response.message) ? "ar" : "en"}
                        closest={turn.response.closest ? { title: turn.response.closest.title, href: postHref(turn.response.closest.slug) } : null}
                        referrals={turn.response.referrals}
                        labels={labels}
                      />
                      <Feedback turn={turn} t={t} onRate={(h) => void feedback(turn, h)} />
                    </>
                  ) : null}
                </div>
              </div>
            </React.Fragment>
          ))}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-3 flex flex-col gap-2.5 rounded-[20px] border border-border bg-surface p-3.5 shadow-md"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="ask" className="text-[13px] font-bold text-text-secondary">
              {t.assistant.label}
            </label>
            <span className="text-xs tabular-nums text-text-muted" dir="ltr">
              {fmtNumber(input.length, locale)}/{fmtNumber(MAX, locale)}
            </span>
          </div>
          <textarea
            id="ask"
            ref={inputRef}
            rows={2}
            maxLength={MAX}
            value={input}
            dir="auto"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t.assistant.placeholder}
            className="resize-none bg-transparent text-[17px] leading-7 outline-none placeholder:text-text-muted"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label={t.assistant.materialLang} className="flex gap-1 rounded-[10px] bg-surface-muted p-1">
              {(["ar", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  lang={l === "en" ? "en" : undefined}
                  onClick={() => setMaterialLang(l)}
                  className={cn(
                    "h-[34px] rounded-sm px-3.5 text-[13px]",
                    lang === l ? "bg-surface font-bold text-primary-700 shadow-[0_1px_2px_rgba(16,24,20,0.08)]" : "font-medium text-text-secondary",
                  )}
                >
                  {l === "ar" ? t.assistant.materialAr : t.assistant.materialEn}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary-700 px-5 text-[15px] font-bold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {t.assistant.send}
            </button>
          </div>
        </form>
        <p className="-mt-3 text-center text-[13px] text-text-muted">{t.common.noFatwa}</p>
      </section>

      <aside aria-label={t.assistant.sources} className="sticky top-24 hidden min-w-0 flex-[1_1_320px] lg:block">
        {sources}
      </aside>

      <D.Root open={sheet} onOpenChange={setSheet}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[rgba(16,24,20,0.4)] data-[state=open]:animate-fade-in lg:hidden" />
          <D.Content
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-surface shadow-lg outline-none data-[state=open]:animate-fade-in lg:hidden"
            aria-describedby={undefined}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
              <span className="mx-auto h-1 w-10 rounded-full bg-border-strong absolute inset-x-0 top-1.5" aria-hidden />
              <D.Title className="text-base font-bold">{t.assistant.sources}</D.Title>
              <D.Close className="grid size-11 place-items-center rounded-md text-text-secondary hover:bg-surface-muted" aria-label={t.nav.closeMenu}>
                <X className="size-5" aria-hidden />
              </D.Close>
            </div>
            <div className="p-4">{sources}</div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}

function Feedback({ turn, t, onRate }: { turn: Turn; t: Dict; onRate: (helpful: boolean) => void }) {
  if (turn.feedback) {
    return (
      <p className="text-[13px] font-bold text-success-fg" role="status">
        {t.assistant.thanks}
      </p>
    );
  }
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-[13px] hover:bg-primary-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-text-muted">{t.assistant.wasHelpful}</span>
      <button type="button" className={btn} onClick={() => onRate(true)}>
        <ThumbsUp className="size-[15px]" aria-hidden />
        {t.assistant.helpful}
      </button>
      <button type="button" className={btn} onClick={() => onRate(false)}>
        <ThumbsDown className="size-[15px]" aria-hidden />
        {t.assistant.notHelpful}
      </button>
    </div>
  );
}

function SourcesPanel({ turn, index, t, locale }: { turn?: Turn; index: number; t: Dict; locale: "ar" | "en" }) {
  const r = turn?.response;
  const list: SourceBrief[] = r?.sources ?? [];
  const threshold = r?.threshold ?? null;
  const shownId = r?.type === "match" ? r.post.id : null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">{t.assistant.sources}</h2>
        {turn && <span className="text-xs text-text-muted">{t.assistant.sourcesFor(fmtNumber(index, locale))}</span>}
      </div>
      <p className="text-[13px] leading-[22px] text-text-secondary">{t.assistant.sourcesDesc}</p>
      {turn?.status === "loading" ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-md" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-md bg-surface-muted p-3 text-[13px] text-text-muted">{t.assistant.sourcesEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((s, i) => {
            const above = threshold !== null && s.similarity >= threshold;
            const shown = s.post_id === shownId;
            const tag = shown ? t.assistant.shown : above ? t.assistant.relatedTag : t.assistant.belowThreshold;
            return (
              <li key={s.post_id}>
                <Link
                  href={postHref(s.slug)}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border p-3.5 text-text hover:shadow-sm",
                    shown ? "border-approved-border bg-primary-50" : "border-border",
                  )}
                >
                  <span className="flex justify-between gap-2">
                    <span className="text-[15px] font-bold">
                      {fmtNumber(i + 1, locale)}. {s.title}
                    </span>
                    <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", above ? "text-success-fg" : "text-text-muted")} dir="ltr">
                      {pct(s.similarity)}
                    </span>
                  </span>
                  <span className="text-xs text-text-muted">
                    {s.section ? `${s.section} · ` : ""}
                    {tag}
                  </span>
                  <span className="relative h-1.5 rounded-full bg-border" aria-hidden>
                    <span
                      className={cn("absolute inset-y-0 start-0 rounded-full", above ? "bg-success" : "bg-text-disabled")}
                      style={{ width: pct(s.similarity) }}
                    />
                    {threshold !== null && (
                      <span className="absolute -inset-y-1 w-0.5 bg-danger/70" style={{ insetInlineStart: pct(threshold) }} />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {threshold !== null && (
        <div className="flex items-center gap-2 rounded-[10px] bg-surface-muted p-3 text-[13px] text-text-secondary">
          <Info className="size-4 shrink-0" aria-hidden />
          <span>
            {t.assistant.threshold("")}
            <bdi dir="ltr">{pct(threshold)}</bdi>
          </span>
        </div>
      )}
    </div>
  );
}
