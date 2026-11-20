"use client";

import { Cpu, History, Lock, RotateCcw, Save, ScanSearch, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Slider, Switch } from "@/components/ui/controls";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Alert, CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
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

interface Form {
  guidance_prompt: string;
  similarity_threshold: number;
  top_k: number;
  fallback_message_ar: string;
  fallback_message_en: string;
}

const toForm = (s: AISettings): Form => ({
  guidance_prompt: s.guidance_prompt,
  similarity_threshold: s.similarity_threshold,
  top_k: s.top_k,
  fallback_message_ar: s.fallback_message_ar,
  fallback_message_en: s.fallback_message_en,
});

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
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={4} />
          </div>
          <CardSkeleton lines={4} />
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
      setError("رسالتا البدائل (ع/En) مطلوبتان");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api<AISettings>("/api/admin/ai/settings", {
        method: "PUT",
        body: {
          ...form,
          guidance_prompt: form.guidance_prompt,
          fallback_message_ar: form.fallback_message_ar.trim(),
          fallback_message_en: form.fallback_message_en.trim(),
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
      <PageHeader
        title="الإعدادات والتعليمات"
        description="تتحكم في أسلوب جملة التوجيه وفي قرار الاسترجاع فقط — لا في مضمون الرد."
        actions={
          <>
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden />
              استرجاع إصدار سابق
            </Button>
            <Button variant="ghost" onClick={() => setForm(toForm(initial))} disabled={!dirty || saving}>
              <RotateCcw aria-hidden />
              تراجع
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {!saving && <Save aria-hidden />}
              حفظ كإصدار جديد
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* القواعد الثابتة — قراءة فقط */}
          <section
            className="rounded-lg border border-border bg-surface-muted p-5"
            aria-labelledby="fixed-rules"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-surface text-text-secondary">
                <Lock className="size-4" aria-hidden />
              </span>
              <h2 id="fixed-rules" className="text-body font-bold">
                القواعد الثابتة للنظام
              </h2>
              <Badge variant="outline" className="ms-auto">
                قراءة فقط
              </Badge>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "لا يولّد المساعد أي رد شرعي — النموذج يصنّف السؤال ويكتب جملة توجيه قصيرة فقط.",
                "يعرض النص المعتمد حرفياً من المنشور المنشور، مع مصدره ورابطه.",
                "يحيل عند عدم التوفر: رسالة البدائل + أقرب مادة + المراكز المعتمدة.",
              ].map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <Lock className="mt-1 size-3.5 shrink-0 text-text-muted" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-text-muted">هذه القواعد مكتوبة في النظام ولا تتغير من هنا.</p>
          </section>

          {/* تعليمات الأسلوب */}
          <Card>
            <CardHeader
              title="تعليمات الأسلوب"
              description="تُدمج بعد القواعد الثابتة، وتؤثر في صياغة جملة التوجيه فقط."
              icon={<Type />}
              actions={
                <Badge variant="primary" aria-label={`الإصدار ${initial.version}`}>
                  الإصدار {formatNumber(initial.version)}
                </Badge>
              }
            />
            <CardBody className="space-y-3">
              <Field
                id="guidance"
                label="التعليمات"
                aside={
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      form.guidance_prompt.length > PROMPT_MAX ? "text-danger" : "text-text-muted",
                    )}
                  >
                    {formatNumber(form.guidance_prompt.length)} / {formatNumber(PROMPT_MAX)}
                  </span>
                }
              >
                <Textarea
                  id="guidance"
                  rows={10}
                  maxLength={PROMPT_MAX}
                  value={form.guidance_prompt}
                  onChange={(e) => set("guidance_prompt", e.target.value)}
                  className={cn("min-h-56 leading-7", mono && "font-mono text-[13px]")}
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <span>
                  آخر تعديل: {initial.updated_at ? formatRelative(initial.updated_at) : "—"}
                  {initial.updated_by_user && ` · بواسطة ${initial.updated_by_user.name}`}
                </span>
                <label className="flex items-center gap-2">
                  <Switch checked={mono} onCheckedChange={setMono} aria-label="خط ثابت العرض" />
                  خط ثابت العرض
                </label>
              </div>
            </CardBody>
          </Card>

          {/* إعدادات الاسترجاع */}
          <Card>
            <CardHeader title="إعدادات الاسترجاع" description="متى يعرض المساعد مادة، ومتى يحيل." icon={<ScanSearch />} />
            <CardBody className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="threshold" className="text-sm font-medium">
                    عتبة التشابه
                  </label>
                  <span className="rounded-sm bg-primary-100 px-2 py-0.5 font-en text-sm font-bold tabular-nums text-primary-700" dir="ltr">
                    {form.similarity_threshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="threshold"
                  aria-label="عتبة التشابه"
                  min={Math.min(T_MIN, form.similarity_threshold)}
                  max={Math.max(T_MAX, form.similarity_threshold)}
                  step={0.01}
                  value={[form.similarity_threshold]}
                  onValueChange={([v]) => set("similarity_threshold", Math.round(v * 100) / 100)}
                />
                <div className="mt-1.5 flex justify-between font-en text-xs text-text-muted" dir="ltr">
                  <span>{T_MIN.toFixed(2)}</span>
                  <span>{T_MAX.toFixed(2)}</span>
                </div>
                <p className="mt-2 text-sm font-normal text-text-secondary">
                  أعلى = أدق وأقل نتائج (إحالات أكثر). أقل = نتائج أكثر مع خطر عرض مادة بعيدة. جرّب الأثر في «مختبر الاختبار» قبل الحفظ.
                </p>
                {outOfRange && (
                  <p className="mt-1 text-xs text-warning-fg">القيمة الحالية خارج المدى المقترح (0.50–0.95).</p>
                )}
              </div>
              <Field id="topk" label="عدد النتائج (top_k)" hint="عدد المواد التي يسترجعها البحث (1–10).">
                <Input
                  id="topk"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={10}
                  value={form.top_k}
                  onChange={(e) => set("top_k", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="w-28"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="fb-ar" label="رسالة البدائل (ع)" required>
                  <Textarea id="fb-ar" rows={5} value={form.fallback_message_ar} onChange={(e) => set("fallback_message_ar", e.target.value)} />
                </Field>
                <Field id="fb-en" label="Fallback message (En)" required>
                  <Textarea
                    id="fb-en"
                    rows={5}
                    lang="en"
                    dir="ltr"
                    value={form.fallback_message_en}
                    onChange={(e) => set("fallback_message_en", e.target.value)}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* النموذج */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="النموذج" icon={<Cpu />} />
            <CardBody className="space-y-4 text-sm">
              <div>
                <p className="text-text-muted">نماذج التوجيه والتصنيف (بالترتيب)</p>
                <ul className="mt-1.5 space-y-1">
                  {initial.chat_models.map((m, i) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">{i + 1}.</span>
                      <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-en text-xs" dir="ltr">
                        {m}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-text-muted">نموذج الـ Embeddings</p>
                <code className="mt-1.5 inline-block rounded-sm bg-surface-muted px-1.5 py-0.5 font-en text-xs" dir="ltr">
                  {initial.embedding_model}
                </code>
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-1.5 text-text-muted">حالة الاتصال</p>
                {gemini ? (
                  <StatusDot state={gemini.state} label={`Gemini — ${gemini.state === "ok" ? "متصل" : "غير متصل"}`} />
                ) : (
                  <Skeleton className="h-5 w-32" />
                )}
              </div>
              <p className="text-xs text-text-muted">أسماء النماذج تُغيَّر من backend/.env فقط.</p>
            </CardBody>
          </Card>
          {dirty && (
            <Alert variant="warning" title="تعديلات غير محفوظة">
              الحفظ يُنشئ الإصدار {formatNumber(initial.version + 1)} ويحفظ الحالي في السجل.
            </Alert>
          )}
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        {historyOpen && (
          <HistorySheet
            currentVersion={initial.version}
            onRestored={(s) => {
              setHistoryOpen(false);
              onSaved(s);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function HistorySheet({ currentVersion, onRestored }: { currentVersion: number; onRestored: (s: AISettings) => void }) {
  const history = useApi<AISettingsHistory[]>("/api/admin/ai/settings/history");
  const [confirm, setConfirm] = useState<AISettingsHistory | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

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
    <SheetContent
      title="سجل الإصدارات"
      description={`الإصدار الحالي: ${formatNumber(currentVersion)}. الاسترجاع يُنشئ إصداراً جديداً بنفس القيم.`}
      className="max-w-lg"
    >
      {history.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : history.error ? (
        <ErrorState compact message={history.error.message} onRetry={history.reload} />
      ) : !history.data?.length ? (
        <EmptyState icon={<History />} title="لا إصدارات سابقة" description="كل حفظ للإعدادات يضيف نسخة من الإصدار السابق هنا." />
      ) : (
        <ol className="space-y-3">
          {history.data.map((h) => (
            <li key={h.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">الإصدار {formatNumber(h.version)}</p>
                  <p className="text-xs text-text-muted">
                    حُفظ حتى {formatDate(h.saved_at)}
                    {h.updated_by_user && ` · ${h.updated_by_user.name}`}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setConfirm(h)}>
                  <RotateCcw aria-hidden />
                  استرجاع
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="neutral">
                  العتبة <span dir="ltr">{h.similarity_threshold.toFixed(2)}</span>
                </Badge>
                <Badge variant="neutral">top_k {h.top_k}</Badge>
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-primary-600 hover:underline"
                onClick={() => setExpanded(expanded === h.id ? null : h.id)}
                aria-expanded={expanded === h.id}
              >
                {expanded === h.id ? "إخفاء التعليمات" : "عرض التعليمات"}
              </button>
              {expanded === h.id && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-surface-muted p-3 font-sans text-xs leading-5">
                  {h.guidance_prompt || "(فارغة)"}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`استرجاع الإصدار ${confirm?.version ?? ""}؟`}
        description="ستُطبَّق تعليماته وعتبته ورسائله فوراً على المساعد، ويُحفظ الإصدار الحالي في السجل."
        confirmLabel="استرجاع"
        variant="primary"
        loading={busy}
        onConfirm={restore}
      />
    </SheetContent>
  );
}
