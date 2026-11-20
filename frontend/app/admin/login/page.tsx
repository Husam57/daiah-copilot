"use client";

import { Eye, EyeOff } from "lucide-react";
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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 py-8 sm:p-8">
      {/* النجمة الثمانية بشفافية 5% (AdminLogin.dc.html) */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -bottom-[200px] -start-[160px] size-[620px] opacity-5"
        fill="none"
        stroke="#0F4C47"
        strokeWidth={0.6}
      >
        <rect x="20" y="20" width="60" height="60" />
        <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="18" />
      </svg>
      <form
        onSubmit={submit}
        noValidate
        className="relative flex w-full max-w-[420px] flex-col gap-[22px] rounded-xl border border-border bg-surface p-6 shadow-lg sm:p-10"
        aria-labelledby="login-title"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-[52px] rounded-[14px] [&_svg]:size-[26px]" />
          <h1 id="login-title" className="text-h2 text-text">
            لوحة تحكم رفيق الداعية
          </h1>
          <p className="text-[15px] text-text-secondary">سجّل دخولك لإدارة المحتوى والمساعد.</p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Field id="email" label="البريد الإلكتروني">
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-md px-3.5 text-start text-base"
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
              className="h-12 rounded-md pe-12 ps-3.5 text-base"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute end-1 top-1 grid size-10 place-items-center rounded-[10px] text-text-secondary hover:bg-surface-muted hover:text-text"
              aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={show}
            >
              {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
        </Field>

        <Button type="submit" className="h-12 w-full text-base" loading={loading}>
          تسجيل الدخول
        </Button>
        <p className="text-center text-[13px] text-text-muted">الدخول للمدير والمحررين المعتمدين فقط.</p>
      </form>
    </main>
  );
}
