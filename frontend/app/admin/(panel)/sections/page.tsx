"use client";

import { FileText, FolderTree, LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented, Switch } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Alert, CardSkeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatNumber } from "@/lib/format";
import type { Category, Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn, safeStorage } from "@/lib/utils";

type TreeRow = Section & { depth: number };
const VIEW_KEY = "daiah.sections.view";

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

export default function SectionsPage() {
  const { data, error, loading, reload } = useApi<Section[]>("/api/admin/sections");
  const { refreshCounts } = useShell();
  const [view, setView] = useState<"cards" | "table">(() =>
    typeof window !== "undefined" && safeStorage.get(VIEW_KEY) === "table" ? "table" : "cards",
  );
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

  const actions = (s: Section) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
        <Pencil aria-hidden />
        تعديل
      </Button>
      <Link href={`/admin/posts?section_id=${s.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <FileText aria-hidden />
        المنشورات
      </Link>
      <Tooltip content="لا يمكن حذف قسم يحتوي على منشورات" disabled={s.posts_count === 0}>
        {/* span حتى يعمل الـ Tooltip على زر معطّل */}
        <span tabIndex={s.posts_count > 0 ? 0 : -1}>
          <Button
            variant="danger-ghost"
            size="icon-sm"
            disabled={s.posts_count > 0}
            onClick={() => setDeleting(s)}
            aria-label={`حذف القسم ${s.name_ar}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </span>
      </Tooltip>
    </div>
  );

  const columns: Column<TreeRow>[] = [
    {
      key: "name",
      header: "الاسم",
      primary: true,
      cell: (s) => (
        <div className="min-w-0" style={{ paddingInlineStart: s.depth * 20 }}>
          <p className="font-bold text-text">
            {s.depth > 0 && <span className="me-1 text-text-muted" aria-hidden>└</span>}
            {s.name_ar}
          </p>
          {s.name_en && (
            <p className="text-xs text-text-muted" lang="en" dir="ltr">
              {s.name_en}
            </p>
          )}
        </div>
      ),
    },
    { key: "category", header: "المسار", cell: (s) => <Badge variant="primary">{CATEGORY_LABELS[s.category]}</Badge> },
    {
      key: "desc",
      header: "الوصف",
      hideOnMobile: true,
      className: "max-w-xs",
      cell: (s) => <span className="line-clamp-2 text-text-secondary">{s.description || "—"}</span>,
    },
    { key: "count", header: "المنشورات", cell: (s) => formatNumber(s.posts_count) },
    { key: "active", header: "الحالة", cell: (s) => <ActiveBadge active={s.is_active} /> },
    { key: "actions", header: <span className="sr-only">إجراءات</span>, actions: true, cell: actions },
  ];

  return (
    <>
      <PageHeader
        title="الأقسام"
        description="تنظيم المواد في أقسام ضمن المسارات الأربعة. الأقسام الموقوفة لا تظهر في الموقع العام."
        actions={
          <>
            <Segmented
              label="طريقة العرض"
              value={view}
              onChange={(v) => {
                setView(v);
                safeStorage.set(VIEW_KEY, v);
              }}
              options={[
                { value: "cards", label: <span className="sr-only sm:not-sr-only">بطاقات</span>, icon: <LayoutGrid aria-hidden /> },
                { value: "table", label: <span className="sr-only sm:not-sr-only">جدول</span>, icon: <List aria-hidden /> },
              ]}
            />
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              قسم جديد
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : !loading && tree.length === 0 ? (
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
      ) : view === "table" ? (
        <DataTable columns={columns} rows={tree} rowKey={(s) => s.id} loading={loading} caption="الأقسام" />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tree
            .filter((s) => s.depth === 0)
            .map((root) => {
              const kids = tree.filter((t) => t !== root && descendants(data ?? [], root.id).has(t.id));
              return (
                <div key={root.id} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <SectionCard section={root} actions={actions(root)} />
                  {kids.map((k) => (
                    <SectionCard key={k.id} section={k} actions={actions(k)} parentName={root.name_ar} />
                  ))}
                </div>
              );
            })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <SectionForm
            key={editing === "new" ? "new" : editing.id}
            section={editing === "new" ? null : editing}
            all={data ?? []}
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

function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge variant="success">مفعّل</Badge> : <Badge variant="neutral">موقوف</Badge>;
}

function SectionCard({
  section: s,
  actions,
  parentName,
}: {
  section: TreeRow;
  actions: React.ReactNode;
  parentName?: string;
}) {
  return (
    <Card interactive className={cn("flex flex-col p-5", s.depth > 0 && "border-dashed")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {parentName && <p className="mb-0.5 text-xs text-text-muted">قسم فرعي من «{parentName}»</p>}
          <h3 className="truncate text-h3 text-text">{s.name_ar}</h3>
          {s.name_en && (
            <p className="truncate text-sm text-text-muted" lang="en" dir="ltr">
              {s.name_en}
            </p>
          )}
        </div>
        <ActiveBadge active={s.is_active} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-12 text-sm font-normal text-text-secondary">
        {s.description || "بلا وصف"}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <Badge variant="primary">{CATEGORY_LABELS[s.category]}</Badge>
        <span>{formatNumber(s.posts_count)} منشور</span>
      </div>
      <div className="mt-4 border-t border-border pt-3">{actions}</div>
    </Card>
  );
}

function SectionForm({ section, all, onSaved }: { section: Section | null; all: Section[]; onSaved: () => void }) {
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
      description={section ? section.name_ar : "أضف قسماً ضمن أحد المسارات الأربعة."}
      footer={
        <>
          <Button type="submit" form="section-form" loading={saving}>
            {section ? "حفظ التعديلات" : "إنشاء القسم"}
          </Button>
        </>
      }
    >
      <form id="section-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Field id="s-name-ar" label="الاسم بالعربية" required error={errors.name_ar}>
          <Input id="s-name-ar" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} autoFocus />
        </Field>
        <Field id="s-name-en" label="الاسم بالإنجليزية" hint="يُستخدم أيضاً لتوليد الرابط المختصر.">
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
        <Field id="s-parent" label="القسم الأب" hint="اختياري — لإنشاء قسم فرعي.">
          <Select
            id="s-parent"
            value={form.parent_id ?? ""}
            onChange={(e) => set("parent_id", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— قسم رئيسي —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {"— ".repeat(p.depth)}
                {p.name_ar}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="s-desc" label="الوصف">
          <Textarea id="s-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="s-slug" label="الرابط المختصر" hint={section ? undefined : "يُولَّد تلقائياً إن تُرك فارغاً"} error={errors.slug}>
            <Input id="s-slug" dir="ltr" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="my-section" />
          </Field>
          <Field id="s-order" label="الترتيب">
            <Input
              id="s-order"
              type="number"
              dir="ltr"
              lang="en"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
            />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium">القسم مفعّل</span>
            <span className="block text-xs text-text-muted">الموقوف لا يظهر في الموقع العام.</span>
          </span>
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} aria-label="القسم مفعّل" />
        </label>
      </form>
    </SheetContent>
  );
}
