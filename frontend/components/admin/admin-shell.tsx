"use client";

import { LogOut, Menu, Search, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Brand } from "@/components/brand";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { breadcrumbFor, isActive, NAV, type NavItem } from "./nav";
import { useShell } from "./shell-context";
import { TopbarSlotProvider, useTopbarSlot } from "./topbar-actions";

/** هيكل اللوحة حسب AdminSidebar.dc.html: قائمة 248px + شريط علوي (مسار + بحث/أزرار الصفحة). */
export function AdminShell({ children }: { children: React.ReactNode }) {
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

  return (
    <TopbarSlotProvider>
      <div className="flex min-h-dvh bg-bg">
        <a
          href="#main"
          className="sr-only z-[70] rounded-md bg-primary-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          تخطَّ إلى المحتوى
        </a>

        <aside
          className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-[22px] border-e border-border bg-surface px-3.5 py-5 lg:flex"
          aria-label="القائمة الجانبية"
        >
          <SidebarContent />
        </aside>

        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="start" title={<Brand subtitle="لوحة التحكم" />} className="max-w-72 lg:hidden">
            <div className="-mx-5 -my-5 flex h-full flex-col gap-[22px] px-3.5 py-5">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} hideBrand />
            </div>
          </SheetContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawerOpen(true)} onSearch={() => setPaletteOpen(true)} />
          <main
            id="main"
            tabIndex={-1}
            className="w-full max-w-[1240px] flex-1 px-4 pb-12 pt-7 outline-none md:px-8"
          >
            {children}
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TopbarSlotProvider>
  );
}

function SidebarContent({ onNavigate, hideBrand }: { onNavigate?: () => void; hideBrand?: boolean }) {
  const pathname = usePathname();
  const { counts } = useShell();
  return (
    <>
      {!hideBrand && (
        <Link href="/admin" className="rounded-md px-2" aria-label="رفيق الداعية — الرئيسية">
          <Brand subtitle="لوحة التحكم" />
        </Link>
      )}
      <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto text-sm" aria-label="لوحة التحكم">
        {NAV.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && <p className="px-2.5 pb-1.5 text-xs font-bold text-text-muted">{group.label}</p>}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                count={item.counter ? counts[item.counter] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>
      <UserFooter onNavigate={onNavigate} />
    </>
  );
}

function NavLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <span aria-disabled="true" className="flex h-10 items-center gap-2.5 px-2.5 text-text-muted">
        <Icon className="size-[18px] shrink-0 text-text-disabled" aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-secondary">قريباً</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 transition-colors duration-150",
        active ? "bg-primary-100 font-bold text-primary-700" : "font-medium text-text hover:bg-surface-muted",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-primary-700" : "text-text-secondary")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {!!count && count > 0 && (
        <span
          className={cn(
            "grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold",
            item.tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-warning-bg text-warning-fg",
          )}
          aria-label={`${formatNumber(count)} عنصر`}
        >
          {formatNumber(count)}
        </span>
      )}
    </Link>
  );
}

/** بطاقة المستخدم أسفل القائمة: الأحرف الأولى + الاسم + «حسابي»، وقائمة بالحساب وتسجيل الخروج. */
function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-auto flex items-center gap-2.5 border-t border-border px-2.5 py-3 text-start hover:bg-bg"
          aria-label="قائمة الحساب"
        >
          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-primary-100 font-bold text-primary-700">
            {user?.name?.trim()?.[0] ?? "؟"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{user?.name}</span>
            <span className="text-xs text-text-muted">حسابي</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate" dir="ltr">
            {user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            router.push("/admin/account");
          }}
        >
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
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const { setEl, count } = useTopbarSlot();
  const crumbs = breadcrumbFor(pathname);
  return (
    <header className="sticky top-0 z-40 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3.5 md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="-ms-2 grid size-10 place-items-center rounded-[10px] text-text-secondary hover:bg-surface-muted lg:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <nav aria-label="مسار التنقل" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-sm text-text-muted">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={i} className="flex min-w-0 items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {c.href ? (
                    <Link href={c.href} className="truncate hover:text-primary-600">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn("truncate", last && "font-bold text-text")} aria-current={last ? "page" : undefined}>
                      {c.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div ref={setEl} className="contents" />
      {count === 0 && (
        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-bg px-3 text-sm text-text-muted transition-colors hover:border-border-strong sm:min-w-[260px]"
          aria-label="بحث سريع (Ctrl+K)"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-start sm:inline">بحث سريع</span>
          <span className="hidden sm:inline-flex">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      )}
    </header>
  );
}
