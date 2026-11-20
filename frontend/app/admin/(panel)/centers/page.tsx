"use client";

import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ReferralCard } from "@/components/ui/answer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Alert, CardSkeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { ReferralCenter } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CentersPage() {
  const { data, error, loading, reload } = useApi<ReferralCenter[]>("/api/admin/referral-centers");
  const [editing, setEditing] = useState<ReferralCenter | "new" | null>(null);
  const [deleting, setDeleting] = useState<ReferralCenter | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/referral-centers/${deleting.id}`, { method: "DELETE" });
      toast.success(`حُذف «${deleting.name}»`);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="المراكز المعتمدة"
        description="تظهر للمستخدم عندما لا تتوفر مادة معتمدة لسؤاله (حالة البدائل)."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            مركز جديد
          </Button>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title="لا توجد مراكز معتمدة"
            description="أضف مراكز يُحال إليها السائل عندما لا تتوفر إجابة في المنصة."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                مركز جديد
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <ReferralCard
              key={c.id}
              center={c}
              actions={
                <div className="-me-2 -mt-1 flex shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={`تعديل ${c.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="danger-ghost" size="icon-sm" onClick={() => setDeleting(c)} aria-label={`حذف ${c.name}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <CenterForm
            key={editing === "new" ? "new" : editing.id}
            center={editing === "new" ? null : editing}
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
        title="حذف المركز؟"
        description="لن يظهر بعد الآن في بطاقة البدائل."
        itemName={deleting?.name}
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}

function CenterForm({ center, onSaved }: { center: ReferralCenter | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: center?.name ?? "",
    country: center?.country ?? "",
    url: center?.url ?? "",
    contact: center?.contact ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "اسم المركز مطلوب";
    if (form.url.trim() && !/^https?:\/\/\S+$/i.test(form.url.trim())) errs.url = "رابط غير صحيح (يبدأ بـ https://)";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      country: form.country.trim() || null,
      url: form.url.trim() || null,
      contact: form.contact.trim() || null,
    };
    try {
      if (center) await api(`/api/admin/referral-centers/${center.id}`, { method: "PUT", body });
      else await api("/api/admin/referral-centers", { method: "POST", body });
      toast.success(center ? "حُفظ المركز" : `أُضيف «${body.name}»`);
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetContent
      title={center ? "تعديل المركز" : "مركز جديد"}
      footer={
        <Button type="submit" form="center-form" loading={saving}>
          {center ? "حفظ التعديلات" : "إضافة المركز"}
        </Button>
      }
    >
      <form id="center-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Field id="c-name" label="الاسم" required error={errors.name}>
          <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <Field id="c-country" label="الدولة">
          <Input id="c-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field id="c-url" label="الرابط" error={errors.url}>
          <Input id="c-url" dir="ltr" inputMode="url" placeholder="https://" value={form.url} onChange={(e) => set("url", e.target.value)} />
        </Field>
        <Field id="c-contact" label="التواصل" hint="بريد أو هاتف.">
          <Input id="c-contact" dir="auto" value={form.contact} onChange={(e) => set("contact", e.target.value)} />
        </Field>
      </form>
    </SheetContent>
  );
}
