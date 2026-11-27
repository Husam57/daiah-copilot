"use client";

import { CheckCircle2, ChevronDown, FlaskConical, History, Info, Loader2, ScanSearch } from "lucide-react";
import Link from "next/link";
import { Collapsible } from "radix-ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApprovedTextCard, FallbackCard, GuidanceBubble, SourceChip } from "@/components/ui/answer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Select, Textarea } from "@/components/ui/input";
import { Kbd, PageHeader } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatNumber, formatScore } from "@/lib/format";
import type { LabResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 1000;
const SOURCE_LABEL: Record<string, string> = {
  model: "النموذج",
  template: "قالب ثابت",
  heuristic: "كشف تلقائي",
  full: "النص كاملاً (قصير)",
  mixed: "النموذج + تلقائي",
};

/** مختبر الاختبار حسب AdminLab.dc.html: نموذج السؤال ثم 3 مراحل قابلة للطي.
 * ‎?q=…&lang=en يملأ السؤال جاهزاً (من «اختبر في المختبر» في الأسئلة المقترحة) دون إرساله. */
export default function LabPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <Lab />
    </Suspense>
  );
}

function Lab() {
  const params = useSearchParams();
  const [message, setMessage] = useState(() => (params.get("q") ?? "").slice(0, MAX));
  const [lang, setLang] = useState<"ar" | "en">(() => (params.get("lang") === "en" ? "en" : "ar"));
  const [result, setResult] = useState<{ q: string; data: LabResult; ms: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ q: string; lang: "ar" | "en"; decision: string }[]>([]);

  const run = async (q = message, l = lang) => {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const data = await api<LabResult>("/api/admin/ai/test", { method: "POST", body: { message: text, lang: l } });
      setResult({ q: text, data, ms: performance.now() - t0 });
      setRecent((r) => [{ q: text, lang: l, decision: data.decision }, ...r.filter((x) => x.q !== text)].slice(0, 6));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex max-w-[1100px] flex-col gap-5">
      <PageHeader
        className="mb-0"
        title="مختبر الاختبار"
        description="جرّب سؤالاً وشاهد ماذا استرجع النظام، ولماذا، وماذا سيرى المستخدم. الاختبار لا يُسجَّل في سجل الأسئلة."
      />

      <Card className="p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="lab-q" className="text-sm font-bold">
              السؤال
            </label>
            <span dir="ltr" className="text-xs tabular-nums text-text-muted">
              {formatNumber(message.length)}/{formatNumber(MAX)}
            </span>
          </div>
          <Textarea
            id="lab-q"
            dir="auto"
            rows={2}
            maxLength={MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="اكتب سؤالاً كما سيكتبه المستخدم…"
            className="rounded-md p-3 text-base leading-7"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select
              aria-label="لغة المادة"
              value={lang}
              onChange={(e) => setLang(e.target.value as "ar" | "en")}
              className="h-[42px] min-w-48 text-sm"
            >
              <option value="ar">لغة المادة: العربية</option>
              <option value="en">لغة المادة: English</option>
            </Select>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-text-muted sm:inline">
                <Kbd>Ctrl Enter</Kbd>
              </span>
              <Button type="submit" size="lg" className="px-[22px]" loading={loading} disabled={!message.trim()}>
                اختبار
              </Button>
            </div>
          </div>
        </form>
        {recent.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <History className="size-4 text-text-muted" aria-label="اختبارات سابقة" />
            {recent.map((r) => (
              <button
                key={r.q}
                type="button"
                onClick={() => {
                  setMessage(r.q);
                  setLang(r.lang);
                  void run(r.q, r.lang);
                }}
                className="inline-flex max-w-64 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-primary-500/40"
              >
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", r.decision === "match" ? "bg-success" : "bg-text-muted")}
                  aria-label={r.decision === "match" ? "تطابق" : "بدائل"}
                />
                <span className="truncate" dir="auto">
                  {r.q}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && !result ? (
        <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            يبحث في المحتوى المعتمد…
          </p>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : !result ? (
        <Card>
          <EmptyState
            icon={<FlaskConical />}
            title="اكتب سؤالاً لترى كيف يتصرف المساعد"
            description="ستظهر ثلاث مراحل: التحليل، ما استرجعه النظام بدرجات التشابه مقابل العتبة، وما سيراه المستخدم."
          />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")} aria-live="polite">
          <ResultView data={result.data} ms={result.ms} />
        </div>
      )}
    </div>
  );
}

function Stage({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <section aria-label={`المرحلة ${formatNumber(n)}: ${title}`} className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Collapsible.Trigger className="flex items-center gap-2.5 rounded-sm text-start">
            <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-primary-700 text-[13px] font-bold text-white">
              {formatNumber(n)}
            </span>
            <h2 className="text-base font-bold">{title}</h2>
            <ChevronDown className={cn("size-4 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
          </Collapsible.Trigger>
          {aside}
        </div>
        <Collapsible.Content className="flex flex-col gap-3.5">{children}</Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="rounded-[10px] bg-surface-muted px-3.5 py-2 text-sm">
      {label}: <b>{children}</b>
    </span>
  );
}

function ResultView({ data, ms }: { data: LabResult; ms: number }) {
  const t = data.threshold;
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  const preview = data.preview;
  const cat = data.classification.category;
  const top = data.top_score;

  return (
    <>
      <Stage n={1} title="التحليل">
        <div className="flex flex-wrap gap-2.5">
          <Chip label="التصنيف">
            {cat === "unknown" ? "غير مصنّف" : CATEGORY_LABELS[cat]}{" "}
            <span className="font-en font-medium text-text-muted" dir="ltr">
              ({cat})
            </span>
          </Chip>
          <Chip label="لغة السؤال">{data.classification.lang === "en" ? "English" : "العربية"}</Chip>
          <Chip label="لغة المادة المطلوبة">{data.requested_lang === "en" ? "English" : "العربية"}</Chip>
          <Chip label="زمن الاستجابة">
            {(ms / 1000).toLocaleString("ar", { maximumFractionDigits: 1, numberingSystem: "latn" })} ث
          </Chip>
          <Chip label="مصدر التصنيف">
            {SOURCE_LABEL[data.classification.source ?? ""] ?? "—"}
            {data.classification.model && (
              <>
                {" "}
                <span className="font-en text-xs font-medium text-text-muted" dir="ltr">
                  {data.classification.model}
                </span>
              </>
            )}
          </Chip>
        </div>
        <p className="text-xs text-text-muted">التصنيف للتسجيل والتحليل فقط ولا يصفّي البحث.</p>
      </Stage>

      <Stage
        n={2}
        title="ما استرجعه النظام"
        aside={
          <span className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
            <span className="h-4 w-0.5 bg-danger" aria-hidden />
            حد الارتباط <span dir="ltr" className="font-en">{t.toFixed(2)}</span>
            <span className="text-text-muted">· top_k = {data.top_k}</span>
          </span>
        }
      >
        {data.results.length === 0 ? (
          <EmptyState icon={<ScanSearch />} title="لم يُسترجع أي مقطع" description="الفهرس فارغ أو لا توجد منشورات منشورة." className="py-6" />
        ) : (
          <ol className="flex flex-col gap-3.5">
            {data.results.map((r) => (
              <li
                key={r.post_id}
                className={cn(
                  "flex flex-col gap-2 rounded-md border p-3.5",
                  r.above_threshold ? "border-approved-border bg-primary-50" : "border-border bg-surface",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link href={`/admin/posts/${r.post_id}`} className="text-[15px] font-bold hover:text-primary-600">
                      {r.title}
                    </Link>
                    {r.section && <span className="text-xs text-text-muted">{r.section}</span>}
                    <span className="rounded-sm border border-border bg-surface px-1.5 text-[11px] font-bold text-text-secondary">
                      {r.chunk_lang === "en" ? "EN" : "ع"}
                    </span>
                  </span>
                  <span
                    className={cn("font-en text-sm font-extrabold tabular-nums", r.above_threshold ? "text-success-fg" : "text-text-muted")}
                    lang="en"
                  >
                    {formatScore(r.similarity)}
                  </span>
                </div>
                {/* الشريط: 0 → 1، وخط العتبة في موضعه (ما فوقه أخضر وما تحته رمادي) */}
                <div className="relative h-2.5 rounded-full bg-track" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", r.above_threshold ? "bg-success" : "bg-text-disabled")}
                    style={{ width: pct(r.similarity) }}
                  />
                  <div className="absolute -inset-y-1 w-0.5 bg-danger" style={{ insetInlineStart: pct(t) }} />
                </div>
                <span className="sr-only">
                  {r.above_threshold ? "فوق العتبة" : "تحت العتبة"}: {formatScore(r.similarity)} مقابل {t.toFixed(2)}
                </span>
                <details className="text-[13px] text-text-secondary">
                  <summary className="cursor-pointer font-bold text-primary-600">عرض المقطع المطابق</summary>
                  <p
                    className="mt-2 whitespace-pre-line leading-6"
                    dir={r.chunk_lang === "en" ? "ltr" : "rtl"}
                    lang={r.chunk_lang}
                  >
                    {r.best_chunk}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        )}
      </Stage>

      <Stage
        n={3}
        title="ما سيراه المستخدم"
        aside={
          data.decision === "match" ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-success-bg px-3 py-1 text-[13px] font-bold text-success-fg">
              <CheckCircle2 className="size-4" aria-hidden />
              تطابق — <span dir="ltr">{formatScore(top)}</span> أعلى من العتبة
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning-bg px-3 py-1 text-[13px] font-bold text-warning-fg">
              <Info className="size-4" aria-hidden />
              بدائل — {top === null ? "لا نتائج" : <><span dir="ltr">{formatScore(top)}</span> أقل من العتبة</>}
            </span>
          )
        }
      >
        <p className="text-xs text-text-muted">
          {data.decision === "match"
            ? `جملة التوجيه من: ${SOURCE_LABEL[data.guidance_source ?? ""] ?? "—"} · الاقتباس من: ${SOURCE_LABEL[data.extractor_source ?? ""] ?? "—"}`
            : "لا توجد مادة فوق العتبة، فتظهر رسالة عدم التوفر مع أقرب مادة والمراكز."}{" "}
          · إعدادات الإصدار {formatNumber(data.settings_version)}
        </p>
        <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-border-strong bg-bg p-4 md:p-5">
          {preview.type === "match" ? (
            <>
              <GuidanceBubble text={preview.guidance} lang={data.classification.lang} />
              {(preview.items ?? []).map((item, idx, arr) => (
                <ApprovedTextCard
                  key={item.id}
                  title={item.title}
                  sectionName={item.section}
                  html={item.content}
                  sourceName={item.source_name}
                  externalRef={item.external_ref}
                  lang={item.lang}
                  langFallback={item.lang_fallback}
                  badgeIndex={arr.length > 1 ? idx + 1 : undefined}
                  isExcerpt={item.is_excerpt}
                  truncatedStart={item.truncated_start}
                  truncatedEnd={item.truncated_end}
                  readMoreHref={`/admin/posts/${item.id}`}
                />
              ))}
              {preview.related.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold">مواد ذات صلة</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {preview.related.map((r, i) => (
                      <SourceChip key={r.post_id} index={i + 2} title={r.title} similarity={r.similarity} href={`/admin/posts/${r.post_id}`} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <FallbackCard
              message={preview.message}
              lang={data.classification.lang}
              closest={
                preview.closest
                  ? { title: preview.closest.title, similarity: preview.closest.similarity, href: `/admin/posts/${preview.closest.post_id}` }
                  : null
              }
              referrals={preview.referrals}
            />
          )}
        </div>
      </Stage>
    </>
  );
}
