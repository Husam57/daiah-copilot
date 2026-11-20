"use client";

import { Direction, Tooltip } from "radix-ui";
import { Toaster } from "@/components/ui/toast";

/** مزودات عامة: اتجاه RTL لمكونات Radix + Tooltip + Toast. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Direction.Provider dir="rtl">
      <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
        {children}
        <Toaster />
      </Tooltip.Provider>
    </Direction.Provider>
  );
}
