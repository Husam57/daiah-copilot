"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ShellProvider } from "@/components/admin/shell-context";
import { BrandMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/feedback";
import { useAuth } from "@/lib/auth";

/** كل مسارات /admin (عدا الدخول) محمية: الضيف يُحوَّل إلى /admin/login?next=… */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "guest") {
      const next = pathname + window.location.search;
      router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") return <ShellSkeleton />;

  return (
    <ShellProvider>
      <AdminShell>{children}</AdminShell>
    </ShellProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-bg" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="hidden w-66 shrink-0 border-e border-border bg-surface p-5 lg:block">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-border bg-surface" />
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-8">
          <Skeleton className="h-9 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
