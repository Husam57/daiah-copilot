"use client";

import { ArrowDown, ArrowUp, FlaskConical, History, Lightbulb, Lock, MessageCircleQuestion, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { TopbarActions } from "@/components/admin/topbar-actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Slider, Switch } from "@/components/ui/controls";
import { Alert, CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlays";
import { StatusDot } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import type { AISettings, AISettingsHistory } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const PROMPT_MAX = 4000;
const T_MIN = 0.5;
const T_MAX = 0.95;
/** نفس حدود الـ Backend (app/models.py: SUGGESTED_MAX و SUGGESTED_MAX_CHARS) */
const Q_MAX = 6;
const Q_CHARS = 120;

/** القواعد الثابتة كما هي مطبّقة في backend/app/agent (لا تتغير من اللوحة). */
const FIXED_RULES = [
  "لا يولّد المساعد أي رد شرعي أو فتوى أو حكم.",
  "يعرض نص المادة المعتمدة حرفياً مع مصدرها.",
  "يبحث في المنشورات المنشورة فقط.",
  "إذا لم تتجاوز أي مادة حد الارتباط، يحيل للمراكز المعتمدة.",
];

interface Form {
  guidance_prompt: string;
  similarity_threshold: number;
  top_k: number;
  fallback_message_ar: string;
  fallback_message_en: string;
  suggested_questions: string[];
}

const toForm = (s: AISettings): Form => ({
  guidance_prompt: s.guidance_prompt,
  similarity_threshold: s.similarity_threshold,
  top_k: s.top_k,
  fallback_message_ar: s.fallback_message_ar,
  fallback_message_en: s.fallback_message_en,
  suggested_questions: s.suggested_questions ?? [],
});

const cleanQuestions = (qs: string[]) => qs.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean);

const sectionCard = "flex flex-col rounded-lg border border-border bg-surface p-[22px]";

export default function AISettingsPage() {
  const settings = useApi<AISettings>("/api/admin/ai/settings");
  if (settings.error) {
    return (
      <>
        <PageHeader title="الإعدادات والتعليمات" />
        <Card>
          <ErrorState message={settings.error.message} onRetry={settings.reload} />
        </Card>
      </>
    );
  }
  if (!settings.data) {
    return (
      <>
        <PageHeader title="الإعدادات والتعليمات" />
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={6} />
            <CardSkeleton lines={4} />
          </div>
          <CardSkeleton lines={5} className="min-w-0 flex-[1_1_280px]" />
        </div>
      </>
    );
  }
  return <SettingsForm key={settings.data.version} initial={settings.data} onSaved={settings.mutate} />;
}

function SettingsForm({ initial, onSaved }: { initial: AISettings; onSaved: (s: AISettings) => void }) {
  const { system } = useShell();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [mono, setMono] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(initial));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const gemini = system?.items.find((i) => i.key === "gemini");
  const outOfRange = initial.similarity_threshold < T_MIN || initial.similarity_threshold > T_MAX;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = async () => {
    if (!form.fallback_message_ar.trim() || !form.fallback_message_en.trim()) {
      setError("رسالتا عدم التوفر (بالعربية والإنجليزية) مطلوبتان");
      return;
    }
    const questions = cleanQuestions(form.suggested_questions);
    if (questions.some((q) => q.length > Q_CHARS)) {
      setError(`كل سؤال مقترح يجب ألا يزيد عن ${formatNumber(Q_CHARS)} حرفاً`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api<AISettings>("/api/admin/ai/settings", {
        method: "PUT",
        body: {
          ...form,
          fallback_message_ar: form.fallback_message_ar.trim(),
          fallback_message_en: form.fallback_message_en.trim(),
          suggested_questions: questions,
        },
      });
      toast.success(`حُفظت الإعدادات — الإصدار ${res.version}`);
      onSaved(res);
    } catch (e) {
      setError(errorMessage(e));
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopbarActions>
        <Link href="/admin/ai/lab" className={buttonVariants({ variant: "secondary" })}>
          <FlaskConical aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">تجربة في المختبر</span>
          <span className="sr-only sm:hidden">تجربة في المختبر</span>
        </Link>
        {dirty && (
          <Button variant="ghost" onClick={() => setForm(toForm(initial))} disabled={saving} aria-label="تراجع عن التعديلات">
            <RotateCcw aria-hidden />
          </Button>
        )}
        <Button className="px-[18px]" onClick={save} loading={saving} disabled={!dirty}>
          حفظ كإصدار جديد
        </Button>
      </TopbarActions>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <h1 className="text-[26px] font-bold leading-[38px]">الإعدادات والتعليمات</h1>

          {error && <Alert variant="danger">{error}</Alert>}
          {dirty && (
            <Alert variant="warning">
              تعديلات غير محفوظة — الحفظ يُنشئ الإصدار {formatNumber(initial.version + 1)} ويحفظ الحالي في السجل.
            </Alert>
          )}

          {/* القواعد الثابتة — قراءة فقط */}
          <section aria-labelledby="fixed-rules" className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border border-border bg-surface text-text-secondary">
                <Lock className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col">
                <h2 id="fixed-rules" className="text-base font-bold">
                  القواعد الثابتة للنظام
                </h2>
                <span className="text-[13px] text-text-secondary">مكتوبة في النظام ولا تتغير من هنا.</span>
              </span>
            </div>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-[15px] leading-[26px]">
              {FIXED_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>

          {/* تعليمات الأسلوب */}
          <section aria-label="تعليمات الأسلوب" className={cn(sectionCard, "gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="guidance" className="text-base font-bold">
                تعليمات الأسلوب
              </label>
              <Badge variant="primary">الإصدار {formatNumber(initial.version)} — مفعّل</Badge>
            </div>
            <p className="text-sm text-text-secondary">
              تتحكم في نبرة جملة التوجيه فقط: الترحيب، والإيجاز، وأسلوب التدرج. لا تؤثر على محتوى المواد.
            </p>
            <Textarea
              id="guidance"
              rows={8}
              maxLength={PROMPT_MAX}
              value={form.guidance_prompt}
              onChange={(e) => set("guidance_prompt", e.target.value)}
              className={cn("rounded-md p-3.5 leading-7", mono && "font-mono text-[13px]")}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
              <span>
                آخر تعديل: {initial.updated_at ? formatRelative(initial.updated_at) : "—"}
                {initial.updated_by_user && ` — ${initial.updated_by_user.name}`}
              </span>
              <span className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <Switch checked={mono} onCheckedChange={setMono} aria-label="خط ثابت العرض" />
                  خط ثابت العرض
                </label>
                <span className={cn("tabular-nums", form.guidance_prompt.length > PROMPT_MAX && "text-danger")}>
                  <span dir="ltr">
                    {formatNumber(form.guidance_prompt.length)} / {formatNumber(PROMPT_MAX)}
                  </span>{" "}
                  حرف
                </span>
              </span>
            </div>
          </section>

          {/* إعدادات الاسترجاع */}
          <section aria-labelledby="retrieval" className={cn(sectionCard, "gap-5")}>
            <h2 id="retrieval" className="text-base font-bold">
              إعدادات الاسترجاع
            </h2>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="threshold" className="text-sm font-bold">
                  حد الارتباط (العتبة)
                </label>
                <span className="font-en text-lg font-extrabold tabular-nums text-primary-700" lang="en" dir="ltr">
                  {form.similarity_threshold.toFixed(2)}
                </span>
              </div>
              <Slider
                id="threshold"
                aria-label="حد الارتباط (العتبة)"
                min={Math.min(T_MIN, form.similarity_threshold)}
                max={Math.max(T_MAX, form.similarity_threshold)}
                step={0.01}
                value={[form.similarity_threshold]}
                onValueChange={([v]) => set("similarity_threshold", Math.round(v * 100) / 100)}
              />
              <div className="flex justify-between gap-3 text-xs text-text-muted">
                <span>أعلى = أدق وأقل نتائج</span>
                <span>أقل = نتائج أكثر وأقل دقة</span>
              </div>
              {outOfRange && <p className="text-xs text-warning-fg">القيمة الحالية خارج المدى المقترح (0.50–0.95).</p>}
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="min-w-0 flex-[1_1_160px]">
                <Field id="topk" label="عدد النتائج المسترجعة" hint="من 1 إلى 10.">
                  <Input
                    id="topk"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    lang="en"


                    value={form.top_k}
                    onChange={(e) => set("top_k", Math.max(1, Math.min(10, Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))}
                    className="font-en"
                  />
                </Field>
              </div>
              <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-2">
                <span className="text-sm font-bold">النموذج</span>
                <Tooltip content={`${initial.chat_models.join(" ← ")} · ${initial.embedding_model}`}>
                  <span
                    tabIndex={0}
                    className="flex h-11 items-center justify-between gap-2 rounded-[10px] border border-border bg-bg px-3 text-sm"
                  >
                    <span lang="en" dir="ltr" className="truncate font-en">
                      {initial.chat_models[0] ?? "Gemini Flash"}
                    </span>
                    {gemini ? <StatusDot state={gemini.state} /> : <Skeleton className="h-4 w-12" />}
                  </span>
                </Tooltip>
                <span className="text-xs text-text-muted">أسماء النماذج تُغيَّر من backend/.env فقط.</span>
              </div>
            </div>
          </section>

          {/* رسائل عدم التوفر */}
          <section aria-labelledby="fallback-msgs" className={cn(sectionCard, "gap-4")}>
            <h2 id="fallback-msgs" className="text-base font-bold">
              رسالة عدم توفر المادة
            </h2>
            <Field id="fb-ar" label="بالعربية" required>
              <Textarea id="fb-ar" rows={2} value={form.fallback_message_ar} onChange={(e) => set("fallback_message_ar", e.target.value)} />
            </Field>
            <Field id="fb-en" label="بالإنجليزية" required>
              <Textarea
                id="fb-en"
                rows={2}
                lang="en"
                dir="ltr"
                value={form.fallback_message_en}
                onChange={(e) => set("fallback_message_en", e.target.value)}
              />
            </Field>
          </section>

          <SuggestedQuestions value={form.suggested_questions} onChange={(v) => set("suggested_questions", v)} />
        </div>

        <VersionHistory current={initial} onRestored={onSaved} />
      </div>
    </>
  );
}

/** رابط المختبر بالسؤال جاهزاً (بلغة المادة حسب حروف السؤال). */
function labHref(q: string): string {
  const lang = /[\u0600-\u06FF]/.test(q) ? "ar" : "en";
  return `/admin/ai/lab?${new URLSearchParams({ q: q.trim(), lang })}`;
}

/** الأسئلة المقترحة للزائر (الرئيسية + المساعد): إضافة وحذف وإعادة ترتيب، واختبار كل سؤال في المختبر. */
function SuggestedQuestions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const update = (i: number, q: string) => onChange(value.map((x, j) => (j === i ? q : x)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    onChange([...value, ""]);
    requestAnimationFrame(() => document.getElementById(`sq-${value.length}`)?.focus());
  };
  const full = value.length >= Q_MAX;

  return (
    <section aria-labelledby="suggested" className={cn(sectionCard, "gap-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="suggested" className="text-base font-bold">
          الأسئلة المقترحة
        </h2>
        <span className="text-xs tabular-nums text-text-muted">
          {formatNumber(value.length)} / {formatNumber(Q_MAX)}
        </span>
      </div>
      <p className="text-sm text-text-secondary">تظهر للزائر في الرئيسية وصفحة المساعد بهذا الترتيب. إذا كانت القائمة فارغة لا يظهر شيء.</p>
      <div className="flex items-start gap-2 rounded-md border border-approved-border bg-primary-50 px-3 py-2.5 text-[13px] leading-6 text-primary-700">
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>اختر أسئلة لها مواد منشورة حتى تظهر للزائر نتيجة معتمدة.</span>
      </div>

      {value.length === 0 ? (
        <EmptyState
          className="py-6"
          icon={<MessageCircleQuestion />}
          title="لا أسئلة مقترحة"
          description="أضف سؤالاً ثم اختبره في المختبر للتأكد من أنه يطابق مادة منشورة."
        />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {value.map((q, i) => {
            const len = q.trim().length;
            const over = len > Q_CHARS;
            return (
              <li key={i} className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {formatNumber(i + 1)}
                  </span>
                  <Input
                    id={`sq-${i}`}
                    value={q}
                    dir="auto"
                    maxLength={Q_CHARS + 40}
                    aria-label={`السؤال المقترح ${i + 1}`}
                    aria-invalid={over || undefined}
                    placeholder="اكتب سؤالاً كما يطرحه الزائر…"
                    onChange={(e) => update(i, e.target.value)}
                    className={cn("min-w-0 flex-[1_1_220px]", over && "border-danger")}
                  />
                  <span className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="نقل لأعلى">
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="نقل لأسفل">
                      <ArrowDown aria-hidden />
                    </Button>
                    {len > 0 ? (
                      <Link
                        href={labHref(q)}
                        target="_blank"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        aria-label={`اختبر في المختبر: ${q.trim()}`}
                      >
                        <FlaskConical aria-hidden />
                        <span className="hidden sm:inline">اختبر في المختبر</span>
                      </Link>
                    ) : (
                      <Button variant="secondary" size="sm" disabled aria-label="اختبر في المختبر (اكتب السؤال أولاً)">
                        <FlaskConical aria-hidden />
                        <span className="hidden sm:inline">اختبر في المختبر</span>
                      </Button>
                    )}
                    <Button variant="danger-ghost" size="icon-sm" onClick={() => remove(i)} aria-label={`حذف السؤال ${i + 1}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </div>
                <span className={cn("ps-9 text-xs tabular-nums", over ? "text-danger" : "text-text-muted")}>
                  <span dir="ltr">
                    {formatNumber(len)} / {formatNumber(Q_CHARS)}
                  </span>{" "}
                  حرف{over && " — أطول من المسموح"}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <Button variant="soft" className="self-start" onClick={add} disabled={full}>
        <Plus aria-hidden />
        {full ? `الحد الأقصى ${formatNumber(Q_MAX)} أسئلة` : "إضافة سؤال"}
      </Button>
    </section>
  );
}

/** سجل الإصدارات في العمود الجانبي (AdminAISettings.dc.html): الحالي أولاً ثم السابقة مع «استرجاع». */
function VersionHistory({ current, onRestored }: { current: AISettings; onRestored: (s: AISettings) => void }) {
  const history = useApi<AISettingsHistory[]>("/api/admin/ai/settings/history", { v: current.version });
  const [confirm, setConfirm] = useState<AISettingsHistory | null>(null);
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await api<AISettings & { restored_from_version: number }>(
        `/api/admin/ai/settings/restore/${confirm.id}`,
        { method: "POST" },
      );
      toast.success(`استُرجع الإصدار ${confirm.version} كإصدار جديد (${res.version})`);
      setConfirm(null);
      onRestored(res);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      aria-labelledby="versions"
      className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24"
    >
      <h2 id="versions" className="mb-1.5 text-base font-bold">
        سجل الإصدارات
      </h2>
      <div className="flex items-center justify-between gap-2.5 rounded-md border border-approved-border bg-primary-50 p-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-bold">الإصدار {formatNumber(current.version)}</span>
          <span className="truncate text-xs text-text-muted">
            {current.updated_at ? formatRelative(current.updated_at) : "—"}
            {current.updated_by_user && ` — ${current.updated_by_user.name}`}
          </span>
        </span>
        <span className="text-xs font-bold text-primary-700">الحالي</span>
      </div>
      {history.loading ? (
        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
      ) : history.error ? (
        <ErrorState compact message={history.error.message} onRetry={history.reload} />
      ) : !history.data?.length ? (
        <EmptyState
          className="py-6"
          icon={<History />}
          title="لا إصدارات سابقة"
          description="كل حفظ يضيف نسخة من الإصدار السابق هنا."
        />
      ) : (
        <ol className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto">
          {history.data.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2.5 rounded-md border border-border-subtle bg-surface p-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold">الإصدار {formatNumber(h.version)}</span>
                <span className="truncate text-xs text-text-muted" title={formatDate(h.saved_at)}>
                  {formatRelative(h.saved_at)}
                  {h.updated_by_user && ` — ${h.updated_by_user.name}`} · العتبة{" "}
                  <span dir="ltr">{h.similarity_threshold.toFixed(2)}</span>
                </span>
              </span>
              <Button variant="secondary" size="sm" className="h-8 rounded-sm px-3 text-xs" onClick={() => setConfirm(h)}>
                استرجاع
              </Button>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`استرجاع الإصدار ${confirm?.version ?? ""}؟`}
        description={
          <>
            ستُطبَّق تعليماته وعتبته ورسائله فوراً على المساعد، ويُحفظ الإصدار الحالي في السجل.
            {confirm && (
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-sm bg-surface-muted p-3 text-start font-sans text-xs leading-5 text-text">
                {confirm.guidance_prompt || "(تعليمات فارغة)"}
              </pre>
            )}
          </>
        }
        confirmLabel="استرجاع"
        variant="primary"
        loading={busy}
        onConfirm={restore}
      />
    </aside>
  );
}
