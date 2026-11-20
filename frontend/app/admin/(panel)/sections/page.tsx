"use client";

import { FileText, Folder, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatNumber } from "@/lib/format";
import type { Category, Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type TreeRow = Section & { depth: number };

/** يرتب الأقسام كشجرة (الأب ثم أبناؤه بمسافة بادئة). */
function buildTree(sections: Section[]): TreeRow[] {
  const ids = new Set(sections.map((s) => s.id));
  const children = new Map<number | null, Section[]>();
  for (const s of sections) {
    const parent = s.parent_id !== null && ids.has(s.parent_id) ? s.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), s]);
  }
  const out: TreeRow[] = [];
  const seen = new Set<number>();
  const walk = (parent: number | null, depth: number) => {
    for (const s of children.get(parent) ?? []) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({ ...s, depth });
      walk(s.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function descendants(sections: Section[], id: number): Set<number> {
  const out = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of sections) {
      if (s.parent_id !== null && out.has(s.parent_id) && !out.has(s.id)) {
        out.add(s.id);
        grew = true;
      }
    }
  }
  return out;
}

/** الأقسام حسب AdminSections.dc.html: شجرة صفوف (الفرعي بمسافة 40px) + Sheet للإضافة/التعديل. */
export default function SectionsPage() {
  const { data, error, loading, reload } = useApi<Section[]>("/api/admin/sections");
  const { refreshCounts } = useShell();
  const [editing, setEditing] = useState<Section | "new" | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const tree = useMemo(() => buildTree(data ?? []), [data]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/sections/${deleting.id}`, { method: "DELETE" });
      toast.success(`حُذف القسم «${deleting.name_ar}»`);
      setDeleting(null);
      reload();
      refreshCounts();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="الأقسام"
        description="نظّم المحتوى في أقسام وأقسام فرعية، مثل تصنيفات المدونات."
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            قسم جديد
          </Button>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : loading && !data ? (
        <div className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-[18px]">
              <Skeleton className="size-11 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      ) : tree.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderTree />}
            title="لا توجد أقسام بعد"
            description="أنشئ أول قسم لتبدأ بإضافة المنشورات."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                قسم جديد
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="شجرة الأقسام">
          {tree.map((s) => (
            <SectionRow key={s.id} section={s} onEdit={() => setEditing(s)} onDelete={() => setDeleting(s)} />
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <SectionForm
            key={editing === "new" ? "new" : editing.id}
            section={editing === "new" ? null : editing}
            all={data ?? []}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="حذف القسم؟"
        description="سيُحذف القسم نهائياً. الأقسام الفرعية تصبح أقساماً رئيسية."
        itemName={deleting?.name_ar}
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}

const iconBtn =
  "grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-border bg-surface text-text transition-colors hover:border-approved-border hover:bg-primary-50 [&_svg]:size-4";

/** صف قسم: أيقونة · الاسم ع/En · الوصف · العدد · الحالة · (تعديل · المنشورات · حذف). */
function SectionRow({
  section: s,
  onEdit,
  onDelete,
}: {
  section: TreeRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locked = s.posts_count > 0;
  return (
    <li
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-5 py-[18px]"
      style={{ marginInlineStart: Math.min(s.depth, 3) * 40 }}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-100 text-primary-600" aria-hidden>
        <Folder className="size-5" />
      </span>
      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-bold leading-6">{s.name_ar}</span>
          {s.name_en && (
            <span className="text-[13px] text-text-muted" lang="en" dir="ltr">
              {s.name_en}
            </span>
          )}
        </span>
        <span className="text-sm text-text-secondary">
          {s.description || "بلا وصف"}
          <span className="ms-2 text-xs text-text-muted">· {CATEGORY_LABELS[s.category]}</span>
        </span>
      </span>
      <span className="flex min-w-[70px] flex-col items-center gap-0.5">
        <span className="text-lg font-bold tabular-nums">{formatNumber(s.posts_count)}</span>
        <span className="text-xs text-text-muted">منشور</span>
      </span>
      {s.is_active ? <Badge variant="success">مفعّل</Badge> : <Badge variant="neutral">موقوف</Badge>}
      <span className="flex gap-1">
        <button type="button" className={iconBtn} onClick={onEdit} aria-label={`تعديل القسم ${s.name_ar}`}>
          <Pencil aria-hidden />
        </button>
        <Link href={`/admin/posts?section_id=${s.id}`} className={iconBtn} aria-label={`منشورات القسم ${s.name_ar}`}>
          <FileText aria-hidden />
        </Link>
        <Tooltip content={locked ? "لا يمكن حذف قسم فيه منشورات" : `حذف القسم ${s.name_ar}`}>
          {/* span حتى يعمل الـ Tooltip على زر معطّل */}
          <span tabIndex={locked ? 0 : -1}>
            <button
              type="button"
              className={cn(
                iconBtn,
                locked
                  ? "cursor-not-allowed bg-surface-muted text-text-disabled hover:border-border hover:bg-surface-muted"
                  : "text-danger hover:border-danger/30 hover:bg-danger-bg",
              )}
              disabled={locked}
              onClick={onDelete}
              aria-label={`حذف القسم ${s.name_ar}`}
            >
              <Trash2 aria-hidden />
            </button>
          </span>
        </Tooltip>
      </span>
    </li>
  );
}

function SectionForm({
  section,
  all,
  onSaved,
  onCancel,
}: {
  section: Section | null;
  all: Section[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name_ar: section?.name_ar ?? "",
    name_en: section?.name_en ?? "",
    slug: section?.slug ?? "",
    category: (section?.category ?? "methodology") as Category,
    parent_id: section?.parent_id ?? null,
    description: section?.description ?? "",
    sort_order: section?.sort_order ?? 0,
    is_active: section?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const blocked = section ? descendants(all, section.id) : new Set<number>();
  const parents = buildTree(all).filter((s) => !blocked.has(s.id));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name_ar.trim()) errs.name_ar = "الاسم بالعربية مطلوب";
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))
      errs.slug = "حروف إنجليزية صغيرة وأرقام وشرطات فقط";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError(null);
    const body = {
      ...form,
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      description: form.description.trim() || null,
      slug: form.slug.trim() || (section ? undefined : null),
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (section) {
        await api(`/api/admin/sections/${section.id}`, { method: "PUT", body });
        toast.success("حُفظ القسم");
      } else {
        await api("/api/admin/sections", { method: "POST", body });
        toast.success(`أُنشئ القسم «${body.name_ar}»`);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) {
        setErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetContent
      title={section ? "تعديل القسم" : "قسم جديد"}
      description={section ? section.name_ar : undefined}
      footer={
        <>
          <Button type="submit" form="section-form" size="lg" className="flex-1" loading={saving}>
            حفظ القسم
          </Button>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            إلغاء
          </Button>
        </>
      }
    >
      <form id="section-form" onSubmit={submit} className="space-y-[18px]" noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Field id="s-name-ar" label="الاسم بالعربية" required error={errors.name_ar}>
          <Input id="s-name-ar" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} autoFocus />
        </Field>
        <Field id="s-name-en" label="الاسم بالإنجليزية">
          <Input id="s-name-en" lang="en" dir="ltr" value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
        </Field>
        <Field id="s-category" label="المسار" required>
          <Select id="s-category" value={form.category} onChange={(e) => set("category", e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="s-parent" label="القسم الأب" optional>
          <Select
            id="s-parent"
            value={form.parent_id ?? ""}
            onChange={(e) => set("parent_id", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">بدون — قسم رئيسي</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {"— ".repeat(p.depth)}
                {p.name_ar}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="s-desc" label="الوصف">
          <Textarea id="s-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="s-slug"
            label="الرابط المختصر"
            optional
            hint={section ? undefined : "يُولَّد تلقائياً إن تُرك فارغاً"}
            error={errors.slug}
          >
            <Input id="s-slug" dir="ltr" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="my-section" />
          </Field>
          <Field id="s-order" label="الترتيب">
            <Input
              id="s-order"
              type="text"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value.replace(/[^0-9-]/g, "")) || 0)}
            />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="size-[18px] accent-primary-700"
          />
          مفعّل ويظهر في الموقع
        </label>
      </form>
    </SheetContent>
  );
}
