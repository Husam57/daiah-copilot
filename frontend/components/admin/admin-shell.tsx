"use client";

import { ChevronLeft, LogOut, Menu, PanelRightClose, PanelRightOpen, Search, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/overlays";
import { StatusDot } from "@/components/ui/status";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { cn, safeStorage } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { isActive, NAV, SEGMENT_LABELS, type NavItem } from "./nav";
import { useShell } from "./shell-context";

const COLLAPSE_KEY = "daiah.sidebar.collapsed";

export function AdminShell({ children }: { children: React.ReactNode }) {
  // الـ Shell يُعرض بعد التحقق من الدخول في المتصفح فقط، فقراءة التخزين هنا آمنة
  const [collapsed, setCollapsed] = React.useState(() => safeStorage.get(COLLAPSE_KEY) === "1");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      safeStorage.set(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-primary-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        تخطَّ إلى المحتوى
      </a>

      {/* Sidebar (≥1024px) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-18" : "w-66",
        )}
        aria-label="القائمة الجانبية"
      >
        <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-5")}>
          <Link href="/admin" className="min-w-0 rounded-md" aria-label="رفيق الداعية — الرئيسية">
            <Brand subtitle="لوحة التحكم" collapsed={collapsed} />
          </Link>
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-text",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelRightOpen className="size-5 rtl:-scale-x-100" aria-hidden />
            ) : (
              <PanelRightClose className="size-5 rtl:-scale-x-100" aria-hidden />
            )}
            {!collapsed && <span>طي القائمة</span>}
          </button>
        </div>
      </aside>

      {/* Drawer (<1024px) */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="start" title={<Brand subtitle="لوحة التحكم" />} className="max-w-72 lg:hidden">
          <div className="-mx-5 -my-5">
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawerOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { counts } = useShell();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="التنقل الرئيسي">
      {NAV.map((group, gi) => (
        <div key={gi} className={cn(gi > 0 && "mt-5")}>
          {group.label &&
            (collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-xs font-bold text-text-muted">{group.label}</p>
            ))}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                  count={item.counter ? counts[item.counter] : undefined}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const base = cn(
    "relative flex min-h-11 items-center gap-3 rounded-md text-sm transition-colors duration-150",
    collapsed ? "justify-center px-0" : "px-3",
  );

  if (item.soon) {
    const el = (
      <div aria-disabled="true" className={cn(base, "cursor-not-allowed text-text-muted")}>
        <Icon className="size-5 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <Badge variant="neutral">قريباً</Badge>
          </>
        )}
        {collapsed && <span className="sr-only">{item.label} (قريباً)</span>}
      </div>
    );
    return collapsed ? <Tooltip content={`${item.label} — قريباً`} side="left">{el}</Tooltip> : el;
  }

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        active
          ? "bg-primary-100 font-bold text-primary-700"
          : "text-text-secondary hover:bg-surface-muted hover:text-text",
      )}
    >
      {active && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-primary-700" aria-hidden />}
      <Icon className={cn("size-5 shrink-0", active ? "text-primary-600" : "")} aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
      {!!count && count > 0 && (
        <span
          className={cn(
            "grid min-w-5 place-items-center rounded-full bg-warning-bg px-1.5 text-xs font-bold text-warning-fg",
            collapsed && "absolute end-1.5 top-1 min-w-4 px-1 text-[10px] leading-4",
          )}
          aria-label={`${formatNumber(count)} عنصر`}
        >
          {formatNumber(count)}
        </span>
      )}
    </Link>
  );
  return collapsed ? <Tooltip content={item.label} side="left">{link}</Tooltip> : link;
}

const OVERALL_LABEL = { ok: "النظام يعمل", warning: "يحتاج انتباهاً", down: "خلل في النظام" } as const;

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { system, systemError } = useShell();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="-ms-2 grid size-11 place-items-center rounded-md text-text-secondary hover:bg-surface-muted lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <Breadcrumbs />

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 items-center gap-2 rounded-md border border-border bg-bg px-3 text-sm text-text-muted transition-colors hover:border-primary-500/40 hover:text-text sm:w-56"
          aria-label="بحث سريع (Ctrl+K)"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-start sm:inline">بحث سريع…</span>
          <span className="hidden sm:inline-flex">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>

        <Link
          href="/admin#system"
          className="hidden h-10 items-center rounded-md px-2.5 hover:bg-surface-muted md:flex"
          aria-label="حالة النظام"
        >
          <StatusDot
            state={systemError ? "down" : system ? system.overall : "unknown"}
            label={systemError ? "تعذّر الفحص" : system ? OVERALL_LABEL[system.overall] : "جارٍ الفحص…"}
            className="text-text-secondary"
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-md px-1.5 hover:bg-surface-muted"
              aria-label="قائمة الحساب"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                {user?.name?.trim()?.[0] ?? "؟"}
              </span>
              <span className="hidden max-w-32 truncate text-sm font-medium text-text xl:inline">{user?.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-bold text-text">{user?.name}</span>
              <span className="block truncate" dir="ltr">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin/account")}>
              <UserCircle aria-hidden />
              حسابي
            </DropdownMenuItem>
            <DropdownMenuItem
              danger
              onSelect={() => {
                logout();
                router.replace("/admin/login");
              }}
            >
              <LogOut className="rtl:-scale-x-100" aria-hidden />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = SEGMENT_LABELS[seg] ?? (/^\d+$/.test(seg) ? (parts[i - 1] === "review" ? "مراجعة منشور" : "تعديل") : seg);
    // /admin/ai ليست صفحة
    const linkable = href !== "/admin/ai" && i < parts.length - 1;
    return { href, label, linkable };
  });

  return (
    <nav aria-label="مسار التنقل" className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronLeft className="size-4 shrink-0 text-text-muted ltr:-scale-x-100" aria-hidden />}
            {c.linkable ? (
              <Link href={c.href} className="truncate text-text-secondary hover:text-primary-600">
                {c.label}
              </Link>
            ) : (
              <span
                className={cn("truncate", i === crumbs.length - 1 ? "font-bold text-text" : "text-text-secondary")}
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
