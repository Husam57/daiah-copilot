"use client";

import { Direction, Tooltip } from "radix-ui";
import { Toaster } from "@/components/ui/toast";

/** مزودات عامة: اتجاه مكونات Radix (RTL للوحة، وحسب اللغة للموقع) + Tooltip + Toast. */
export function Providers({ children, dir = "rtl" }: { children: React.ReactNode; dir?: "rtl" | "ltr" }) {
  return (
    <Direction.Provider dir={dir}>
      <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
        {children}
        <Toaster />
      </Tooltip.Provider>
    </Direction.Provider>
  );
}
