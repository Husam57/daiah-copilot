import {
  Activity,
  Building2,
  ClipboardCheck,
  Database,
  FileText,
  FlaskConical,
  FolderTree,
  LayoutDashboard,
  MessageCircleQuestion,
  SlidersHorizontal,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type CounterKey = "review" | "unanswered";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  counter?: CounterKey;
  soon?: boolean;
  /** كلمات إضافية للبحث السريع */
  keywords?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ label: "الرئيسية", href: "/admin", icon: LayoutDashboard, keywords: "dashboard إحصاءات" }] },
  {
    label: "المحتوى",
    items: [
      { label: "الأقسام", href: "/admin/sections", icon: FolderTree, keywords: "sections" },
      { label: "المنشورات", href: "/admin/posts", icon: FileText, keywords: "posts مواد مقالات" },
      { label: "المراجعة", href: "/admin/review", icon: ClipboardCheck, counter: "review", keywords: "review اعتماد" },
    ],
  },
  {
    label: "الذكاء الاصطناعي",
    items: [
      { label: "الإعدادات والتعليمات", href: "/admin/ai/settings", icon: SlidersHorizontal, keywords: "settings عتبة prompt" },
      { label: "قاعدة المعرفة (RAG)", href: "/admin/ai/knowledge", icon: Database, keywords: "rag index فهرس" },
      { label: "مختبر الاختبار", href: "/admin/ai/lab", icon: FlaskConical, keywords: "lab test اختبار" },
      {
        label: "الأسئلة غير المجابة",
        href: "/admin/ai/unanswered",
        icon: MessageCircleQuestion,
        counter: "unanswered",
        keywords: "unanswered fallback",
      },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { label: "المراكز المعتمدة", href: "/admin/centers", icon: Building2, keywords: "centers إحالة" },
      { label: "المستخدمون", href: "/admin/users", icon: Users, soon: true },
      { label: "سجل النشاط", href: "/admin/activity", icon: Activity, soon: true },
    ],
  },
  { items: [{ label: "حسابي", href: "/admin/account", icon: UserCircle, keywords: "account كلمة المرور البريد" }] },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);

/** أسماء أجزاء المسار لشريط التنقل (Breadcrumb). */
export const SEGMENT_LABELS: Record<string, string> = {
  admin: "لوحة التحكم",
  sections: "الأقسام",
  posts: "المنشورات",
  new: "منشور جديد",
  review: "المراجعة",
  ai: "الذكاء الاصطناعي",
  settings: "الإعدادات والتعليمات",
  knowledge: "قاعدة المعرفة",
  lab: "مختبر الاختبار",
  unanswered: "الأسئلة غير المجابة",
  centers: "المراكز المعتمدة",
  account: "حسابي",
};

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
