"use client";

import { Eye, EyeOff, KeyRound, Save, UserCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="حسابي" description="بيانات الدخول إلى لوحة التحكم." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <ProfileCard key={`${user.id}-${user.email}`} user={user} />
        <PasswordCard />
      </div>
    </>
  );
}

function ProfileCard({ user }: { user: User }) {
  const { setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "الاسم مطلوب";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "بريد إلكتروني غير صحيح";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() !== user.name) body.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
      const updated = await api<User>("/api/auth/me", { method: "PUT", body });
      setUser(updated);
      toast.success("حُفظت بيانات الحساب");
    } catch (err) {
      if (err instanceof ApiError && err.fields.length) setErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="البيانات الشخصية"
        icon={<UserCircle />}
        actions={<Badge variant="primary">{user.role === "admin" ? "مدير" : "محرر"}</Badge>}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert variant="danger">{error}</Alert>}
          <Field id="acc-name" label="الاسم" error={errors.name}>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field id="acc-email" label="البريد الإلكتروني" error={errors.email} hint="يُستخدم لتسجيل الدخول.">
            <Input
              id="acc-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" loading={saving} disabled={!dirty}>
            {!saving && <Save aria-hidden />}
            حفظ
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.current_password = "أدخل كلمة المرور الحالية";
    if (next.length < 8) errs.new_password = "8 أحرف على الأقل";
    else if (next === current) errs.new_password = "يجب أن تختلف عن الحالية";
    if (confirm !== next) errs.confirm = "كلمتا المرور غير متطابقتين";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/auth/me/password", { method: "PUT", body: { current_password: current, new_password: next } });
      toast.success("تم تغيير كلمة المرور");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <Card>
      <CardHeader
        title="كلمة المرور"
        icon={<KeyRound />}
        actions={
          <Button variant="ghost" size="icon-sm" onClick={() => setShow((s) => !s)} aria-label={show ? "إخفاء كلمات المرور" : "إظهار كلمات المرور"} aria-pressed={show}>
            {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert variant="danger">{error}</Alert>}
          <Field id="pw-current" label="كلمة المرور الحالية" error={errors.current_password}>
            <Input id="pw-current" type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field id="pw-new" label="كلمة المرور الجديدة" hint="8 أحرف على الأقل." error={errors.new_password}>
            <Input id="pw-new" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field id="pw-confirm" label="تأكيد كلمة المرور الجديدة" error={errors.confirm}>
            <Input id="pw-confirm" type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={saving}>
            {!saving && <KeyRound aria-hidden />}
            تغيير كلمة المرور
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
