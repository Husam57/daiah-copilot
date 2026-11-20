import type { Metadata } from "next";
import { ForceArabic } from "@/components/site/force-locale";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s · لوحة التحكم · رفيق الداعية" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AuthProvider>
      <ForceArabic />
      {children}
    </AuthProvider>
  );
}
