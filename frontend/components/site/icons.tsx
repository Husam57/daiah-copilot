import { BriefcaseBusiness, FileText, LineChart, Link2, ShieldCheck, Users } from "lucide-react";
import type { Category } from "@/lib/types";

/** أيقونة كل مسار (Main.dc.html — استكشف المعرفة). */
export const TRACK_ICON: Record<Category, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  methodology: LineChart,
  shubuhat: ShieldCheck,
  intro_islam: FileText,
  new_muslim: BriefcaseBusiness,
};

export const TRUST_ICONS = [ShieldCheck, Link2, Users];

/** النجمة الثمانية بشفافية خفيفة (خلفية الـ Hero فقط). */
export function StarPattern({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={className} fill="none" stroke="#0F4C47" strokeWidth={0.6}>
      <rect x="20" y="20" width="60" height="60" />
      <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" />
      <circle cx="50" cy="50" r="18" />
      <rect x="32" y="32" width="36" height="36" />
      <rect x="32" y="32" width="36" height="36" transform="rotate(45 50 50)" />
    </svg>
  );
}
