"use client";

import { ChevronDown, Database, ExternalLink, Eye, Info, MoreHorizontal, RefreshCw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Collapsible } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { ApprovedTextCard } from "@/components/ui/answer";
import { IndexBadge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LanguageSwitch, TagsInput } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { SafeHtml } from "@/components/ui/safe-html";
import { Stepper } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CONTENT_TYPE_LABELS, formatDate, formatRelative, postIndexState } from "@/lib/format";
import type { ContentType, Post, PostStatus, PostWithIndex, Section } from "@/lib/types";
import { cn, isHtmlEmpty } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { useShell } from "./shell-context";
import { TopbarActions } from "./topbar-actions";

interface FormState {
  section_id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  content_ar: string;
  content_en: string;
  summary_ar: string;
  tags: string[];
  topic: string;
  source_name: string;
  external_ref: string;
  file_url: string;
  content_type: ContentType;
}

type Errors = Partial<Record<keyof FormState, string>>;

function toForm(p: Post | null, defaults?: Partial<FormState>): FormState {
  return {
    section_id: p ? String(p.section_id) : (defaults?.section_id ?? ""),
    slug: p?.slug ?? "",
    title_ar: p?.title_ar ?? defaults?.title_ar ?? "",
    title_en: p?.title_en ?? "",
    content_ar: p?.content_ar ?? "",
    content_en: p?.content_en ?? "",
    summary_ar: p?.summary_ar ?? "",
    tags: p?.tags ?? [],
    topic: p?.topic ?? "",
    source_name: p?.source_name ?? "",
    external_ref: p?.external_ref ?? "",
    file_url: p?.file_url ?? "",
    content_type: p?.content_type ?? "article",
  };
}

const URL_RE = /^https?:\/\/\S+$/i;

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.title_ar.trim()) e.title_ar = "العنوان بالعربية مطلوب";
  if (isHtmlEmpty(f.content_ar)) e.content_ar = "المحتوى بالعربية مطلوب";
  if (!f.section_id) e.section_id = "اختر القسم";
  if (f.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)) e.slug = "حروف إنجليزية صغيرة وأرقام وشرطات فقط";
  if (f.external_ref && !URL_RE.test(f.external_ref.trim())) e.external_ref = "رابط غير صحيح (يبدأ بـ https://)";
  if (f.file_url && !URL_RE.test(f.file_url.trim())) e.file_url = "رابط غير صحيح (يبدأ بـ https://)";
  if (!isHtmlEmpty(f.content_en) && !f.title_en.trim()) e.title_en = "أضف العنوان الإنجليزي للمحتوى الإنجليزي";
  return e;
}

function toPayload(f: FormState) {
  const opt = (v: string) => v.trim() || null;
  return {
    section_id: Number(f.section_id),
    title_ar: f.title_ar.trim(),
    title_en: opt(f.title_en),
    content_ar: f.content_ar,
    content_en: isHtmlEmpty(f.content_en) ? null : f.content_en,
    summary_ar: opt(f.summary_ar),
    tags: f.tags,
    topic: opt(f.topic),
    source_name: opt(f.source_name),
    external_ref: opt(f.external_ref),
    file_url: opt(f.file_url),
    content_type: f.content_type,
    ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
  };
}

type Action = "save" | "review" | "publish" | "unpublish" | "reindex" | null;

export function PostEditor({
  post: initialPost,
  sections,
  defaults,
}: {
  post: Post | null;
  sections: Section[];
  defaults?: Partial<FormState>;
}) {
  const router = useRouter();
  const { refreshCounts } = useShell();
  const [saved, setSaved] = useState<Post | null>(initialPost);
  const [form, setForm] = useState<FormState>(() => toForm(initialPost, defaults));
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState<"ar" | "en">("ar");
  const [busy, setBusy] = useState<Action>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [indexWarning, setIndexWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [metaOpen, setMetaOpen] = useState(true);

  const isNew = saved === null;
  const status: PostStatus = saved?.status ?? "draft";
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(toForm(saved, defaults)), [form, saved, defaults]);
  const indexState = saved ? postIndexState(saved) : "none";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const check = (): boolean => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) {
      if (e.title_ar || e.content_ar) setTab("ar");
      else if (e.title_en) setTab("en");
      if (e.section_id || e.slug || e.external_ref || e.file_url) setMetaOpen(true);
      toast.error("راجع الحقول المطلوبة");
      return false;
    }
    return true;
  };

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.fields.length) {
      setErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])) as Errors);
    }
    setFormError(errorMessage(err));
    toast.error(errorMessage(err));
  };

  /** حفظ المحتوى؛ nextStatus = review لإرسال للمراجعة. يرجع المنشور المحفوظ. */
  const persist = async (nextStatus?: "draft" | "review"): Promise<Post | null> => {
    const body = toPayload(form);
    if (isNew) {
      const created = await api<Post>("/api/admin/posts", { method: "POST", body: { ...body, status: nextStatus ?? "draft" } });
      return created;
    }
    const res = await api<PostWithIndex>(`/api/admin/posts/${saved.id}`, {
      method: "PUT",
      body: nextStatus ? { ...body, status: nextStatus } : body,
    });
    if (res.index_warning) setIndexWarning(res.index_warning);
    return res;
  };

  const afterSave = (p: Post, wasNew: boolean, msg: string) => {
    setFormError(null);
    if (wasNew) {
      toast.success(msg);
      setSaved(p);
      router.replace(`/admin/posts/${p.id}`);
      return;
    }
    setSaved((prev) => ({ ...p, created_by_name: prev?.created_by_name, reviewed_by_name: prev?.reviewed_by_name }));
    setForm(toForm(p));
    toast.success(msg);
  };

  const run = async (action: Exclude<Action, null>) => {
    if (busy) return;
    if (["save", "review", "publish"].includes(action) && !check()) return;
    setBusy(action);
    setIndexWarning(null);
    const wasNew = isNew;
    try {
      if (action === "save") {
        const p = await persist();
        if (p) afterSave(p, wasNew, status === "published" ? "حُفظت التعديلات وأُعيدت الفهرسة" : "حُفظ المنشور");
      } else if (action === "review") {
        const p = await persist("review");
        if (p) afterSave(p, wasNew, "أُرسل المنشور للمراجعة");
        refreshCounts();
      } else if (action === "publish") {
        const p = await persist();
        if (!p) return;
        const res = await api<PostWithIndex>(`/api/admin/posts/${p.id}/publish`, { method: "POST" });
        if (res.index_warning) {
          setIndexWarning(res.index_warning);
          toast.warning("نُشر المنشور لكن فشلت الفهرسة");
        }
        afterSave(res, wasNew, res.indexed ? `نُشر المنشور وفُهرس (${res.chunks ?? 0} مقطع)` : "نُشر المنشور");
        refreshCounts();
      } else if (action === "unpublish" && saved) {
        const res = await api<PostWithIndex>(`/api/admin/posts/${saved.id}/return-to-draft`, { method: "POST", body: {} });
        setConfirmUnpublish(false);
        afterSave(res, false, "أُلغي النشر وأُعيد المنشور إلى مسودة");
        refreshCounts();
      } else if (action === "reindex" && saved) {
        const res = await api<PostWithIndex>(`/api/admin/posts/${saved.id}/reindex`, { method: "POST" });
        setSaved((prev) => (prev ? { ...prev, indexed_at: res.indexed_at, updated_at: res.updated_at } : prev));
        toast.success(`أُعيدت الفهرسة (${res.chunks ?? 0} مقطع)`);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const sectionOptions = sections;
  const currentSection = sections.find((s) => String(s.id) === form.section_id);

  const typeField = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">نوع المحتوى</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]).map(([v, l]) => {
          const on = form.content_type === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => set("content_type", v)}
              className={cn(
                "h-10 rounded-[10px] border text-sm transition-colors",
                on
                  ? "border-primary-700 bg-primary-100 font-bold text-primary-700"
                  : "border-border bg-surface text-text hover:bg-surface-muted",
              )}
            >
              {l}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const metaMain = (
    <div className="flex flex-col gap-4">
      <Field id="p-section" label="القسم" required error={errors.section_id}>
        <Select id="p-section" value={form.section_id} onChange={(e) => set("section_id", e.target.value)}>
          <option value="">— اختر القسم —</option>
          {sectionOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_ar}
              {!s.is_active ? " (موقوف)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="p-topic" label="الموضوع">
        <Input id="p-topic" value={form.topic} onChange={(e) => set("topic", e.target.value)} />
      </Field>
      {typeField}
      <Field id="p-tags" label="الوسوم" hint="Enter أو فاصلة لإضافة وسم.">
        <TagsInput id="p-tags" value={form.tags} onChange={(t) => set("tags", t)} />
      </Field>
    </div>
  );

  const metaSource = (
    <div className="flex flex-col gap-4">
      <Field id="p-source" label="اسم المصدر" hint="يظهر أسفل بطاقة النص المعتمد.">
        <Input
          id="p-source"
          value={form.source_name}
          placeholder="مثال: اسم الموقع أو الكتاب"
          onChange={(e) => set("source_name", e.target.value)}
        />
      </Field>
      <Field id="p-ref" label="الرابط الخارجي" error={errors.external_ref}>
        <Input
          id="p-ref"
          dir="ltr"
          inputMode="url"
          placeholder="https://"
          value={form.external_ref}
          onChange={(e) => set("external_ref", e.target.value)}
          className="text-sm"
        />
      </Field>
      <Field id="p-file" label="رابط الملف" optional hint="للكتيبات والمطويات (PDF)." error={errors.file_url}>
        <Input
          id="p-file"
          dir="ltr"
          inputMode="url"
          placeholder="https://"
          value={form.file_url}
          onChange={(e) => set("file_url", e.target.value)}
          className="text-sm"
        />
      </Field>
      <Field
        id="p-slug"
        label="الرابط المختصر (slug)"
        optional={isNew}
        hint={isNew ? "يُولَّد من العنوان الإنجليزي." : undefined}
        error={errors.slug}
      >
        <Input
          id="p-slug"
          dir="ltr"
          value={form.slug}
          onChange={(e) => set("slug", e.target.value.toLowerCase())}
          placeholder="post-slug"
          className="text-sm"
        />
      </Field>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* أزرار المنشور في الشريط العلوي بجانب مسار التنقل (AdminEditor.dc.html) */}
      <TopbarActions>
        <Button variant="ghost" className="text-text-secondary" onClick={() => setPreview(true)} aria-label="معاينة">
          <Eye aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">معاينة</span>
        </Button>
        <Button variant="secondary" onClick={() => run("save")} loading={busy === "save"} disabled={!!busy && busy !== "save"}>
          {status === "published" ? "حفظ التعديلات" : status === "review" ? "حفظ" : "حفظ مسودة"}
        </Button>
        {status === "draft" && (
          <Button variant="secondary" onClick={() => run("review")} loading={busy === "review"} disabled={!!busy && busy !== "review"}>
            إرسال للمراجعة
          </Button>
        )}
        {status !== "published" && (
          <Button className="px-[18px]" onClick={() => run("publish")} loading={busy === "publish"} disabled={!!busy && busy !== "publish"}>
            نشر
          </Button>
        )}
        {status === "published" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="إجراءات أخرى">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => window.open(`/posts/${saved?.slug}`, "_blank", "noopener")}>
                <ExternalLink aria-hidden />
                عرض في الموقع
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run("reindex")}>
                <RefreshCw aria-hidden />
                إعادة الفهرسة
              </DropdownMenuItem>
              <DropdownMenuItem danger onSelect={() => setConfirmUnpublish(true)}>
                <Undo2 aria-hidden />
                إلغاء النشر (إرجاع لمسودة)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TopbarActions>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-[38px] text-text">{isNew ? "منشور جديد" : saved.title_ar}</h1>
          <p className="text-xs text-text-muted" aria-live="polite">
            {dirty ? <span className="text-warning-fg">تعديلات غير محفوظة</span> : isNew ? "لم يُحفظ بعد" : "كل التعديلات محفوظة"}
          </p>
        </div>
        <Stepper status={status} indexState={indexState} />
      </div>

      <div className="flex flex-col gap-3">
        <Alert variant="info" icon={<Info aria-hidden />}>
          المنشورات المنشورة فقط هي ما يستخدمه المساعد كمصدر. يُفهرس المنشور تلقائياً عند نشره.
        </Alert>
        {saved?.review_note && status === "draft" && (
          <Alert variant="warning" title="ملاحظة المراجع">
            <p className="whitespace-pre-line">{saved.review_note}</p>
          </Alert>
        )}
        {indexWarning && <Alert variant="warning">{indexWarning}</Alert>}
        {formError && <Alert variant="danger">{formError}</Alert>}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* العمود الرئيسي */}
        <Card className="min-w-0 flex-[999_1_520px] overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "ar" | "en")}>
            <TabsList className="px-5">
              <TabsTrigger value="ar" className="h-12 text-[15px]">
                العربية
                {(errors.title_ar || errors.content_ar) && <span className="size-1.5 rounded-full bg-danger" aria-label="فيه أخطاء" />}
              </TabsTrigger>
              <TabsTrigger value="en" lang="en" className="h-12 text-[15px]">
                English
                {!isHtmlEmpty(form.content_en) && <span className="size-1.5 rounded-full bg-primary-500" aria-label="فيه محتوى" />}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ar" forceMount className="flex flex-col gap-5 p-4 data-[state=inactive]:hidden sm:p-6">
              <Field id="p-title-ar" label="العنوان" required error={errors.title_ar}>
                <Input id="p-title-ar" value={form.title_ar} onChange={(e) => set("title_ar", e.target.value)} className="h-[46px] px-3.5 text-[17px]" />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold" id="p-content-ar-label">
                  المحتوى <span className="text-danger" aria-hidden>*</span>
                </span>
                <RichTextEditor
                  id="p-content-ar"
                  initialValue={form.content_ar}
                  onChange={(html) => set("content_ar", html)}
                  dir="rtl"
                  lang="ar"
                  placeholder="اكتب هنا نص المادة المعتمد كما سيظهر للمستخدم"
                  invalid={!!errors.content_ar}
                  describedBy={errors.content_ar ? "p-content-ar-error" : undefined}
                />
                {errors.content_ar && (
                  <p id="p-content-ar-error" className="text-xs text-danger" role="alert">
                    {errors.content_ar}
                  </p>
                )}
              </div>
              <Field
                id="p-summary"
                label="الملخص"
                hint="يظهر في بطاقات المكتبة ونتائج البحث."
                aside={<span dir="ltr" className="text-xs text-text-muted tabular-nums">{form.summary_ar.length} / 300</span>}
              >
                <Textarea
                  id="p-summary"
                  rows={2}
                  maxLength={300}
                  value={form.summary_ar}
                  onChange={(e) => set("summary_ar", e.target.value)}
                  className="px-3.5 py-3"
                />
              </Field>
            </TabsContent>
            <TabsContent value="en" forceMount className="flex flex-col gap-5 p-4 data-[state=inactive]:hidden sm:p-6" lang="en">
              <p className="text-sm text-text-secondary" lang="ar">
                النسخة الإنجليزية اختيارية. إن لم تُضف، يعرض المساعد النص العربي لمن يطلب الإنجليزية.
              </p>
              <Field id="p-title-en" label="Title" error={errors.title_en}>
                <Input id="p-title-en" dir="ltr" value={form.title_en} onChange={(e) => set("title_en", e.target.value)} className="h-[46px] px-3.5 text-[17px]" />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">Content</span>
                <RichTextEditor
                  id="p-content-en"
                  initialValue={form.content_en}
                  onChange={(html) => set("content_en", html)}
                  dir="ltr"
                  lang="en"
                  placeholder="Approved English text…"
                />
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* العمود الجانبي: لاصق على الشاشات الكبيرة، وقسم قابل للطي على الجوال */}
        <aside aria-label="بيانات المنشور" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-24">
          <Collapsible.Root open={metaOpen} onOpenChange={setMetaOpen} className="flex flex-col gap-4">
            <Collapsible.Trigger className="flex h-12 w-full items-center justify-between rounded-lg border border-border bg-surface px-5 text-sm font-bold lg:hidden">
              بيانات المنشور
              <ChevronDown className={cn("size-4 transition-transform", metaOpen && "rotate-180")} aria-hidden />
            </Collapsible.Trigger>
            <Collapsible.Content forceMount className="flex flex-col gap-4 data-[state=closed]:hidden lg:data-[state=closed]:flex">
              <Card className="p-5">{metaMain}</Card>
              <Card className="p-5">{metaSource}</Card>
            </Collapsible.Content>
          </Collapsible.Root>

          <Card className="p-5 text-sm">
            <dl className="flex flex-col gap-3">
              <InfoRow
                label="آخر تعديل"
                value={saved ? <span title={formatDate(saved.updated_at)}>{formatRelative(saved.updated_at)}</span> : "—"}
              />
              <InfoRow label="بواسطة" value={saved?.created_by_name ?? "—"} />
              {saved?.reviewed_by_name && <InfoRow label="المراجع" value={saved.reviewed_by_name} />}
              {saved?.published_at && <InfoRow label="تاريخ النشر" value={formatDate(saved.published_at)} />}
              <InfoRow label="قاعدة المعرفة" value={<IndexBadge state={indexState} pill />} />
              {saved?.indexed_at && <InfoRow label="آخر فهرسة" value={formatRelative(saved.indexed_at)} />}
            </dl>
            {status === "published" && (
              <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => run("reindex")} loading={busy === "reindex"}>
                {busy !== "reindex" && <Database aria-hidden />}
                إعادة الفهرسة
              </Button>
            )}
          </Card>
        </aside>
      </div>

      <PreviewDialog open={preview} onOpenChange={setPreview} form={form} sectionName={currentSection?.name_ar} sectionNameEn={currentSection?.name_en} />

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="إلغاء نشر المنشور؟"
        description="سيختفي من الموقع العام ومن مصادر المساعد، وتُحذف مقاطعه من الفهرس. يمكنك نشره لاحقاً."
        confirmLabel="إلغاء النشر"
        loading={busy === "unpublish"}
        onConfirm={() => run("unpublish")}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-end font-bold text-text">{value}</dd>
    </div>
  );
}

function PreviewDialog({
  open,
  onOpenChange,
  form,
  sectionName,
  sectionNameEn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: FormState;
  sectionName?: string;
  sectionNameEn?: string | null;
}) {
  const hasEn = !isHtmlEmpty(form.content_en);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const useEn = lang === "en" && hasEn;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="معاينة" description="كما سيظهر في الموقع، وكما يعرضه المساعد." size="xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <LanguageSwitch value={lang} onChange={setLang} size="sm" />
          {lang === "en" && !hasEn && <p className="text-xs text-text-muted">لا توجد نسخة إنجليزية — يُعرض العربي.</p>}
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <article lang={useEn ? "en" : "ar"} dir={useEn ? "ltr" : "rtl"}>
            <p className="mb-2 text-xs font-bold text-text-muted" lang="ar" dir="rtl">
              صفحة المادة
            </p>
            <div className="flex flex-wrap gap-2">
              {sectionName && <span className="rounded-sm bg-primary-100 px-2 py-0.5 text-xs text-primary-700">{useEn ? sectionNameEn || sectionName : sectionName}</span>}
              <VerifiedBadge />
            </div>
            <h2 className="mt-3 text-h2 text-text">{(useEn ? form.title_en : form.title_ar) || "بلا عنوان"}</h2>
            {!useEn && form.summary_ar && <p className="mt-2 text-body text-text-secondary">{form.summary_ar}</p>}
            <SafeHtml html={useEn ? form.content_en : form.content_ar} className="mt-4 max-w-prose text-body-lg" />
            {(form.source_name || form.external_ref) && (
              <div className="mt-6 rounded-md border border-border bg-surface-muted p-4 text-sm" lang="ar" dir="rtl">
                <p className="font-bold">المصدر</p>
                <p className="text-text-secondary">{form.source_name || "—"}</p>
                {form.external_ref && (
                  <a href={form.external_ref} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline" dir="ltr">
                    {form.external_ref}
                  </a>
                )}
              </div>
            )}
          </article>
          <div>
            <p className="mb-2 text-xs font-bold text-text-muted">في المساعد</p>
            <ApprovedTextCard
              title={(useEn ? form.title_en || form.title_ar : form.title_ar) || "بلا عنوان"}
              sectionName={useEn ? sectionNameEn || sectionName : sectionName}
              html={useEn ? form.content_en : form.content_ar}
              sourceName={form.source_name}
              externalRef={form.external_ref || null}
              lang={useEn ? "en" : "ar"}
              langFallback={lang === "en" && !hasEn}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <Skeleton className="mb-6 h-10 w-1/3" />
      <Skeleton className="mb-6 h-12 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[520px] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
