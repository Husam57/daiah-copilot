import { LayoutDashboard, Palette } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

/** صفحة مؤقتة: الموقع العام يأتي في الخطوة 7. */
export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <Brand subtitle="معرفة موثقة، وتوجيه ذكي، في خدمة الدعوة." />
        </div>
        <p className="mt-6 text-body text-text-secondary">الموقع العام قيد الإنشاء.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/admin" className={buttonVariants()}>
            <LayoutDashboard aria-hidden />
            لوحة التحكم
          </Link>
          <Link href="/design-system" className={buttonVariants({ variant: "secondary" })}>
            <Palette aria-hidden />
            نظام التصميم
          </Link>
        </div>
      </div>
    </main>
  );
}
