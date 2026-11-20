"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** الوجهة بعد الدخول: مسار داخلي تحت /admin فقط (منع إعادة التوجيه المفتوح). */
function nextTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next") || "/admin";
  return next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(nextTarget());
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace(nextTarget());
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="size-12 rounded-lg [&_svg]:size-6" />
          <h1 className="mt-4 text-h2 text-primary-700">رفيق الداعية</h1>
          <p className="text-sm text-text-secondary">لوحة التحكم</p>
        </div>
        <form
          onSubmit={submit}
          noValidate
          className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
          aria-labelledby="login-title"
        >
          <h2 id="login-title" className="text-h3 text-text">
            تسجيل الدخول
          </h2>
          <p className="mb-6 mt-1 text-sm font-normal text-text-secondary">ادخل ببيانات حساب المدير.</p>

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <Field id="email" label="البريد الإلكتروني">
              <Input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-start"
                autoFocus
              />
            </Field>
            <Field id="password" label="كلمة المرور">
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 end-0 grid w-11 place-items-center text-text-muted hover:text-text"
                  aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </Field>
          </div>

          <Button type="submit" className="mt-6 w-full" size="lg" loading={loading}>
            {!loading && <LogIn className="rtl:-scale-x-100" aria-hidden />}
            دخول
          </Button>
        </form>
      </div>
    </main>
  );
}
