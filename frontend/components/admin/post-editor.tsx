"use client";

import {
  ArrowRight,
  ChevronDown,
  Database,
  Eye,
  Info,
  MoreHorizontal,
  RefreshCw,
  Save,
  Send,
  Undo2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Collapsible } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { ApprovedTextCard } from "@/components/ui/answer";
import { IndexBadge, StatusBadge, VerifiedBadge } from "@/components/ui/badge";
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

  const meta = (
    <div className="space-y-5">
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
      <Field id="p-type" label="النوع">
        <Select id="p-type" value={form.content_type} onChange={(e) => set("content_type", e.target.value as ContentType)}>
          {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="p-topic" label="الموضوع">
        <Input id="p-topic" value={form.topic} onChange={(e) => set("topic", e.target.value)} />
      </Field>
      <Field id="p-tags" label="الوسوم" hint="Enter أو فاصلة لإضافة وسم.">
        <TagsInput id="p-tags" value={form.tags} onChange={(t) => set("tags", t)} />
      </Field>
      <Field id="p-source" label="اسم المصدر" hint="يظهر أسفل بطاقة النص المعتمد.">
        <Input id="p-source" value={form.source_name} onChange={(e) => set("source_name", e.target.value)} />
      </Field>
      <Field id="p-ref" label="الرابط الخارجي" error={errors.external_ref}>
        <Input id="p-ref" dir="ltr" inputMode="url" placeholder="https://" value={form.external_ref} onChange={(e) => set("external_ref", e.target.value)} />
      </Field>
      <Field id="p-file" label="رابط الملف" hint="للكتيبات والمطويات (PDF)." error={errors.file_url}>
        <Input id="p-file" dir="ltr" inputMode="url" placeholder="https://" value={form.file_url} onChange={(e) => set("file_url", e.target.value)} />
      </Field>
      <Field
        id="p-slug"
        label="الرابط المختصر (slug)"
        hint={isNew ? "اختياري — يُولَّد من العنوان الإنجليزي." : undefined}
        error={errors.slug}
      >
        <Input id="p-slug" dir="ltr" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="post-slug" />
      </Field>
    </div>
  );

  return (
    <div className="pb-10">
      {/* شريط الإجراءات العلوي */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/posts"
            className="grid size-10 shrink-0 place-items-center rounded-md text-text-secondary hover:bg-surface-muted"
            aria-label="العودة إلى المنشورات"
          >
            <ArrowRight className="size-5 ltr:-scale-x-100" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h3 text-text">{isNew ? "منشور جديد" : saved.title_ar}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <StatusBadge status={status} />
              {dirty ? <span className="text-warning-fg">تعديلات غير محفوظة</span> : !isNew && <span>محفوظ</span>}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button variant="ghost" onClick={() => setPreview(true)}>
              <Eye aria-hidden />
              <span className="hidden sm:inline">معاينة</span>
            </Button>
            <Button variant="secondary" onClick={() => run("save")} loading={busy === "save"} disabled={!!busy && busy !== "save"}>
              {busy !== "save" && <Save aria-hidden />}
              {status === "published" ? "حفظ التعديلات" : status === "review" ? "حفظ" : "حفظ مسودة"}
            </Button>
            {status === "draft" && (
              <Button variant="secondary" onClick={() => run("review")} loading={busy === "review"} disabled={!!busy && busy !== "review"}>
                {busy !== "review" && <Send className="rtl:-scale-x-100" aria-hidden />}
                إرسال للمراجعة
              </Button>
            )}
            {status !== "published" && (
              <Button onClick={() => run("publish")} loading={busy === "publish"} disabled={!!busy && busy !== "publish"}>
                {busy !== "publish" && <Upload aria-hidden />}
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
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Alert variant="info" icon={<Info aria-hidden />}>
          المنشورات المنشورة فقط هي ما يستخدمه المساعد كمصدر.
        </Alert>
        {saved?.review_note && status === "draft" && (
          <Alert variant="warning" title="ملاحظة المراجع">
            <p className="whitespace-pre-line">{saved.review_note}</p>
          </Alert>
        )}
        {indexWarning && <Alert variant="warning">{indexWarning}</Alert>}
        {formError && <Alert variant="danger">{formError}</Alert>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* العمود الرئيسي */}
        <Card className="min-w-0 overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "ar" | "en")}>
            <TabsList className="px-3">
              <TabsTrigger value="ar">
                العربية
                {(errors.title_ar || errors.content_ar) && <span className="size-1.5 rounded-full bg-danger" aria-label="فيه أخطاء" />}
              </TabsTrigger>
              <TabsTrigger value="en" lang="en">
                English
                {!isHtmlEmpty(form.content_en) && <span className="size-1.5 rounded-full bg-primary-500" aria-label="فيه محتوى" />}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ar" forceMount className="space-y-5 p-5 data-[state=inactive]:hidden">
              <Field id="p-title-ar" label="العنوان" required error={errors.title_ar}>
                <Input id="p-title-ar" value={form.title_ar} onChange={(e) => set("title_ar", e.target.value)} className="h-11 text-body" />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" id="p-content-ar-label">
                  المحتوى <span className="text-danger" aria-hidden>*</span>
                </span>
                <RichTextEditor
                  id="p-content-ar"
                  initialValue={form.content_ar}
                  onChange={(html) => set("content_ar", html)}
                  dir="rtl"
                  lang="ar"
                  placeholder="اكتب نص المادة المعتمد…"
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
                hint="سطران يظهران في بطاقات المكتبة."
                aside={<span dir="ltr" className="text-xs text-text-muted tabular-nums">{form.summary_ar.length} / 300</span>}
              >
                <Textarea id="p-summary" maxLength={300} value={form.summary_ar} onChange={(e) => set("summary_ar", e.target.value)} />
              </Field>
            </TabsContent>
            <TabsContent value="en" forceMount className="space-y-5 p-5 data-[state=inactive]:hidden" lang="en">
              <p className="text-sm text-text-secondary" lang="ar">
                النسخة الإنجليزية اختيارية. إن لم تُضف، يعرض المساعد النص العربي لمن يطلب الإنجليزية.
              </p>
              <Field id="p-title-en" label="Title" error={errors.title_en}>
                <Input id="p-title-en" dir="ltr" value={form.title_en} onChange={(e) => set("title_en", e.target.value)} className="h-11 text-body" />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Content</span>
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

        {/* العمود الجانبي (لاصق) */}
        <div className="space-y-4 lg:sticky lg:top-40 lg:self-start">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold">سير العمل</p>
              <StatusBadge status={status} />
            </div>
            <Stepper status={status} indexState={indexState} />
          </Card>

          <Collapsible.Root open={metaOpen} onOpenChange={setMetaOpen}>
            <Card className="overflow-hidden">
              <Collapsible.Trigger className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold lg:pointer-events-none">
                بيانات المنشور
                <ChevronDown className={cn("size-4 transition-transform lg:hidden", metaOpen && "rotate-180")} aria-hidden />
              </Collapsible.Trigger>
              <Collapsible.Content forceMount className="border-t border-border p-5 data-[state=closed]:hidden lg:data-[state=closed]:block">
                {meta}
              </Collapsible.Content>
            </Card>
          </Collapsible.Root>

          {!isNew && (
            <Card className="p-5 text-sm">
              <p className="mb-3 font-bold">معلومات</p>
              <dl className="space-y-2.5">
                <InfoRow label="آخر تعديل" value={<span title={formatDate(saved.updated_at)}>{formatRelative(saved.updated_at)}</span>} />
                <InfoRow label="أنشأه" value={saved.created_by_name ?? "—"} />
                <InfoRow label="راجعه" value={saved.reviewed_by_name ?? "—"} />
                {saved.published_at && <InfoRow label="تاريخ النشر" value={formatDate(saved.published_at)} />}
                <InfoRow label="الفهرسة" value={<IndexBadge state={indexState} />} />
                {saved.indexed_at && <InfoRow label="آخر فهرسة" value={formatRelative(saved.indexed_at)} />}
              </dl>
              {status === "published" && (
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => run("reindex")} loading={busy === "reindex"}>
                  {busy !== "reindex" && <Database aria-hidden />}
                  إعادة الفهرسة
                </Button>
              )}
            </Card>
          )}
        </div>
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
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-end text-text">{value}</dd>
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
      <Skeleton className="mb-6 h-14 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[520px] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
