import * as React from "react";

export type CounterKey = "review" | "unanswered";

export type NavIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** أيقونة خطية من مسار SVG واحد (نفس مسارات التصميم المعتمد AdminSidebar). */
function pathIcon(d: string, name: string): NavIcon {
  const C: NavIcon = ({ className }) =>
    React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
        "aria-hidden": true,
      },
      React.createElement("path", { d }),
    );
  C.displayName = name;
  return C;
}

export const NAV_ICONS = {
  home: pathIcon("M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z", "HomeIcon"),
  sections: pathIcon(
    "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z",
    "SectionsIcon",
  ),
  posts: pathIcon("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", "PostsIcon"),
  review: pathIcon("M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "ReviewIcon"),
  settings: pathIcon("M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4", "SettingsIcon"),
  rag: pathIcon("M3 5a9 3 0 1 0 18 0a9 3 0 1 0-18 0M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0", "RagIcon"),
  lab: pathIcon("M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9.5V3", "LabIcon"),
  unanswered: pathIcon("M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01", "UnansweredIcon"),
  referrals: pathIcon("M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6", "ReferralsIcon"),
  users: pathIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8", "UsersIcon"),
  account: pathIcon("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8", "AccountIcon"),
} satisfies Record<string, NavIcon>;

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
  counter?: CounterKey;
  /** لون شارة العدّاد: warn للمراجعة، danger للأسئلة غير المجابة */
  tone?: "warn" | "danger";
  soon?: boolean;
  /** كلمات إضافية للبحث السريع */
  keywords?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ label: "الرئيسية", href: "/admin", icon: NAV_ICONS.home, keywords: "dashboard إحصاءات" }] },
  {
    label: "المحتوى",
    items: [
      { label: "الأقسام", href: "/admin/sections", icon: NAV_ICONS.sections, keywords: "sections" },
      { label: "المنشورات", href: "/admin/posts", icon: NAV_ICONS.posts, keywords: "posts مواد مقالات" },
      {
        label: "المراجعة",
        href: "/admin/review",
        icon: NAV_ICONS.review,
        counter: "review",
        tone: "warn",
        keywords: "review اعتماد",
      },
    ],
  },
  {
    label: "الذكاء الاصطناعي",
    items: [
      { label: "الإعدادات والتعليمات", href: "/admin/ai/settings", icon: NAV_ICONS.settings, keywords: "settings عتبة prompt" },
      { label: "قاعدة المعرفة (RAG)", href: "/admin/ai/knowledge", icon: NAV_ICONS.rag, keywords: "rag index فهرس" },
      { label: "مختبر الاختبار", href: "/admin/ai/lab", icon: NAV_ICONS.lab, keywords: "lab test اختبار" },
      {
        label: "الأسئلة غير المجابة",
        href: "/admin/ai/unanswered",
        icon: NAV_ICONS.unanswered,
        counter: "unanswered",
        tone: "danger",
        keywords: "unanswered fallback",
      },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { label: "المراكز المعتمدة", href: "/admin/centers", icon: NAV_ICONS.referrals, keywords: "centers إحالة" },
      { label: "المستخدمون", href: "/admin/users", icon: NAV_ICONS.users, soon: true },
    ],
  },
];

/** «حسابي» في أسفل القائمة (بطاقة المستخدم) وليس ضمن المجموعات. */
export const ACCOUNT_ITEM: NavItem = {
  label: "حسابي",
  href: "/admin/account",
  icon: NAV_ICONS.account,
  keywords: "account كلمة المرور البريد",
};

export const ALL_NAV_ITEMS = [...NAV.flatMap((g) => g.items), ACCOUNT_ITEM];

/** يُرجع مسار التنقل للصفحة الحالية: [المجموعة, الصفحة, ...] كما في رأس صفحات التصميم. */
export function breadcrumbFor(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") return [{ label: "الرئيسية" }];
  if (pathname === "/admin/account") return [{ label: "حسابي" }];
  for (const g of NAV) {
    for (const it of g.items) {
      if (it.href === "/admin" || !isActive(pathname, it.href)) continue;
      const trail: { label: string; href?: string }[] = g.label ? [{ label: g.label }] : [];
      const rest = pathname.slice(it.href.length).split("/").filter(Boolean);
      const page = it.label.replace(" (RAG)", "");
      if (!rest.length) return [...trail, { label: page }];
      const leaf =
        rest[0] === "new"
          ? "منشور جديد"
          : rest[0] === "import"
            ? "استيراد"
            : it.href === "/admin/review"
              ? "مراجعة منشور"
              : "تعديل منشور";
      return [...trail, { label: page, href: it.href }, { label: leaf }];
    }
  }
  return [];
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
