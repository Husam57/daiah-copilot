import type { Metadata } from "next";

export const metadata: Metadata = { title: "نظام التصميم" };

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
