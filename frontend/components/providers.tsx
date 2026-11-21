"use client";

import dynamic from "next/dynamic";
import { Direction } from "radix-ui";

// Toast يُحمَّل بعد التفاعل الأول للصفحة (لا يدخل في JavaScript التحميل الأولي)
const Toaster = dynamic(() => import("@/components/ui/toast").then((m) => m.Toaster), { ssr: false });

/** مزودات عامة: اتجاه مكونات Radix (RTL للوحة، وحسب اللغة للموقع) + Toast.
 * Tooltip له Provider داخل المكوّن نفسه (components/ui/overlays.tsx). */
export function Providers({ children, dir = "rtl" }: { children: React.ReactNode; dir?: "rtl" | "ltr" }) {
  return (
    <Direction.Provider dir={dir}>
      {children}
      <Toaster />
    </Direction.Provider>
  );
}
