"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface SlotValue {
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
  /** عدد مكونات TopbarActions المعروضة الآن (يُخفى البحث السريع عند وجودها كما في التصميم) */
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
}

const SlotContext = React.createContext<SlotValue | null>(null);

export function TopbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const [count, setCount] = React.useState(0);
  const value = React.useMemo(() => ({ el, setEl, count, setCount }), [el, count]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

export function useTopbarSlot(): SlotValue {
  const ctx = React.useContext(SlotContext);
  if (!ctx) throw new Error("useTopbarSlot يجب أن يُستخدم داخل TopbarSlotProvider");
  return ctx;
}

/** أزرار الصفحة في الشريط العلوي (مثل «حفظ كإصدار جديد» و«نشر» في التصميم المعتمد). */
export function TopbarActions({ children }: { children: React.ReactNode }) {
  const { el, setCount } = useTopbarSlot();
  React.useEffect(() => {
    setCount((c) => c + 1);
    return () => setCount((c) => c - 1);
  }, [setCount]);
  return el ? createPortal(<div className="flex flex-wrap items-center gap-2">{children}</div>, el) : null;
}
