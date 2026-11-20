"use client";

import { ChevronDown, FlaskConical, History, Loader2, Play, ScanSearch, Tags, Eye } from "lucide-react";
import Link from "next/link";
import { Collapsible } from "radix-ui";
import { useState } from "react";
import { ApprovedTextCard, FallbackCard, GuidanceBubble, SourceChip } from "@/components/ui/answer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Kbd, PageHeader } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatNumber, formatScore } from "@/lib/format";
import type { LabResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 1000;
const SOURCE_LABEL: Record<string, string> = { model: "النموذج", template: "قالب ثابت", heuristic: "كشف تلقائي" };

export default function LabPage() {
  const [message, setMessage] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [result, setResult] = useState<{ q: string; data: LabResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ q: string; lang: "ar" | "en"; decision: string }[]>([]);

  const run = async (q = message, l = lang) => {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<LabResult>("/api/admin/ai/test", { method: "POST", body: { message: text, lang: l } });
      setResult({ q: text, data });
      setRecent((r) => [{ q: text, lang: l, decision: data.decision }, ...r.filter((x) => x.q !== text)].slice(0, 6));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="مختبر الاختبار"
        description="نفس مسار المساعد تماماً (التصنيف ← البحث ← القرار) دون تسجيل في السجلات. استخدمه لمعايرة العتبة."
      />

      <Card className="mb-6 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label htmlFor="lab-q" className="text-sm font-medium">
            السؤال
          </label>
          <Textarea
            id="lab-q"
            dir="auto"
            rows={3}
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
            className="mt-1.5 min-h-28 text-body"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-text-secondary">لغة المادة:</span>
              <Segmented
                label="لغة المادة"
                value={lang}
                onChange={setLang}
                size="sm"
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English", lang: "en" },
                ]}
              />
              <span dir="ltr" className="text-xs tabular-nums text-text-muted">
                {formatNumber(message.length)}/{formatNumber(MAX)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-text-muted sm:inline">
                <Kbd>Ctrl Enter</Kbd>
              </span>
              <Button type="submit" loading={loading} disabled={!message.trim()}>
                {!loading && <Play className="rtl:-scale-x-100" aria-hidden />}
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

      {error && (
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {loading && !result ? (
        <div className="space-y-4" aria-live="polite" aria-busy="true">
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
        <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")} aria-live="polite">
          <ResultView data={result.data} />
        </div>
      )}
    </>
  );
}

function Stage({
  n,
  title,
  icon,
  summary,
  children,
}: {
  n: number;
  title: string;
  icon: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <Collapsible.Trigger className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-bg">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {n}
          </span>
          <span className="text-primary-600 [&_svg]:size-5">{icon}</span>
          <span className="flex-1 font-bold">{title}</span>
          {summary && <span className="hidden sm:block">{summary}</span>}
          <ChevronDown className={cn("size-4 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </Collapsible.Trigger>
        <Collapsible.Content className="border-t border-border p-5">{children}</Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}

function ResultView({ data }: { data: LabResult }) {
  const t = data.threshold;
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  const preview = data.preview;
  const cat = data.classification.category;

  return (
    <>
      <Stage
        n={1}
        title="التحليل"
        icon={<Tags />}
        summary={<Badge variant="primary">{cat === "unknown" ? "غير مصنّف" : CATEGORY_LABELS[cat]}</Badge>}
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Item label="التصنيف المكتشف" value={cat === "unknown" ? "غير مصنّف (unknown)" : CATEGORY_LABELS[cat]} />
          <Item label="لغة السؤال" value={data.classification.lang === "en" ? "English" : "العربية"} />
          <Item label="لغة المادة المطلوبة" value={data.requested_lang === "en" ? "English" : "العربية"} />
          <Item
            label="مصدر التصنيف"
            value={
              <>
                {SOURCE_LABEL[data.classification.source ?? ""] ?? "—"}
                {data.classification.model && (
                  <code className="mt-0.5 block font-en text-xs text-text-muted" dir="ltr">
                    {data.classification.model}
                  </code>
                )}
              </>
            }
          />
        </dl>
        <p className="mt-4 text-xs text-text-muted">التصنيف للتسجيل والتحليل فقط ولا يصفّي البحث.</p>
      </Stage>

      <Stage
        n={2}
        title="ما استرجعه النظام"
        icon={<ScanSearch />}
        summary={
          <span className="text-sm text-text-secondary">
            أعلى درجة <b dir="ltr">{formatScore(data.top_score)}</b> · العتبة <b dir="ltr">{t.toFixed(2)}</b>
          </span>
        }
      >
        {data.results.length === 0 ? (
          <EmptyState icon={<ScanSearch />} title="لم يُسترجع أي مقطع" description="الفهرس فارغ أو لا توجد منشورات منشورة." className="py-6" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-success" aria-hidden /> فوق العتبة
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-text-muted/50" aria-hidden /> تحت العتبة
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-0 border-s-2 border-dashed border-danger" aria-hidden /> خط العتبة ({t.toFixed(2)})
              </span>
              <span className="text-text-muted">top_k = {data.top_k}</span>
            </div>
            <ol className="space-y-3">
              {data.results.map((r, i) => (
                <li key={r.post_id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-bold",
                        r.above_threshold ? "bg-success-bg text-success" : "bg-surface-muted text-text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Link href={`/admin/posts/${r.post_id}`} className="min-w-0 flex-1 truncate font-bold hover:text-primary-600">
                      {r.title}
                    </Link>
                    {r.section && <span className="text-xs text-text-muted">{r.section}</span>}
                    <Badge variant="outline">{r.chunk_lang === "en" ? "EN" : "ع"}</Badge>
                    <Badge variant={r.above_threshold ? "success" : "neutral"}>
                      <span dir="ltr" className="tabular-nums">
                        {formatScore(r.similarity)}
                      </span>
                    </Badge>
                  </div>
                  {/* الشريط: 0 → 1، وخط العتبة في موضعه */}
                  <div className="relative h-3 rounded-full bg-surface-muted" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", r.above_threshold ? "bg-success" : "bg-text-muted/50")}
                      style={{ width: pct(r.similarity) }}
                    />
                    <div
                      className="absolute -inset-y-1 w-0 border-s-2 border-dashed border-danger"
                      style={{ insetInlineStart: pct(t) }}
                    />
                  </div>
                  <span className="sr-only">
                    {r.above_threshold ? "فوق العتبة" : "تحت العتبة"}: {formatScore(r.similarity)} مقابل {t.toFixed(2)}
                  </span>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary-600">أفضل مقطع مطابق</summary>
                    <p
                      className="mt-2 whitespace-pre-line rounded-sm bg-surface-muted p-3 text-xs leading-5 text-text-secondary"
                      dir={r.chunk_lang === "en" ? "ltr" : "rtl"}
                      lang={r.chunk_lang}
                    >
                      {r.best_chunk}
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          </>
        )}
      </Stage>

      <Stage
        n={3}
        title="ما سيراه المستخدم"
        icon={<Eye />}
        summary={
          data.decision === "match" ? <Badge variant="success">تطابق</Badge> : <Badge variant="warning">بدائل</Badge>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {data.decision === "match" ? <Badge variant="success">تطابق</Badge> : <Badge variant="warning">بدائل (fallback)</Badge>}
          <span className="text-text-muted">
            {data.decision === "match"
              ? `جملة التوجيه من: ${SOURCE_LABEL[data.guidance_source ?? ""] ?? "—"}`
              : "لا توجد مادة فوق العتبة"}{" "}
            · إعدادات الإصدار {data.settings_version}
          </span>
        </div>
        <div className="mx-auto max-w-3xl space-y-4 rounded-lg bg-bg p-4 md:p-6">
          {preview.type === "match" ? (
            <>
              <GuidanceBubble text={preview.guidance} lang={data.classification.lang} />
              <ApprovedTextCard
                title={preview.post.title}
                sectionName={preview.post.section}
                html={preview.post.content}
                sourceName={preview.post.source_name}
                externalRef={preview.post.external_ref}
                lang={preview.post.lang}
                langFallback={preview.post.lang_fallback}
                readMoreHref={`/admin/posts/${preview.post.id}`}
              />
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

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  );
}
