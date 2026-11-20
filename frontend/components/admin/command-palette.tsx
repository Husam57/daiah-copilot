"use client";

import { CornerDownLeft, FileText, Loader2, Plus, Search } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { StatusBadge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { PostPage } from "@/lib/types";
import { useDebounced } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS } from "./nav";

interface Item {
  id: string;
  label: string;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  href: string;
}

/** بحث سريع (Ctrl+K): الصفحات + المنشورات بالعنوان. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-text/30 data-[state=open]:animate-fade-in" />
        <div className="pointer-events-none fixed inset-0 z-50 flex justify-center p-4 pt-[12vh]">
          <D.Content className="pointer-events-auto flex h-fit max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none data-[state=open]:animate-pop-in">
            <D.Title className="sr-only">بحث سريع</D.Title>
            <D.Description className="sr-only">ابحث في صفحات اللوحة وعناوين المنشورات</D.Description>
            {open && <PaletteBody onClose={() => onOpenChange(false)} />}
          </D.Content>
        </div>
      </D.Portal>
    </D.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [posts, setPosts] = React.useState<{ q: string; page: PostPage } | null>(null);
  const debounced = useDebounced(q.trim(), 250);

  React.useEffect(() => {
    if (debounced.length < 2) return;
    const ctrl = new AbortController();
    api<PostPage>("/api/admin/posts", { query: { q: debounced, page_size: 6 }, signal: ctrl.signal })
      .then((page) => setPosts({ q: debounced, page }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [debounced]);

  const term = q.trim().toLowerCase();
  const pages: Item[] = ALL_NAV_ITEMS.filter((n) => !n.soon)
    .filter((n) => !term || n.label.toLowerCase().includes(term) || n.keywords?.toLowerCase().includes(term))
    .map((n) => {
      const Icon = n.icon;
      return { id: n.href, label: n.label, icon: <Icon aria-hidden />, href: n.href };
    });
  const actions: Item[] =
    !term || "منشور جديد إنشاء".includes(term)
      ? [{ id: "new-post", label: "منشور جديد", icon: <Plus aria-hidden />, href: "/admin/posts/new" }]
      : [];
  const searching = debounced.length >= 2 && posts?.q !== debounced;
  const postItems: Item[] =
    debounced.length >= 2 && posts?.q === debounced
      ? posts.page.items.map((p) => ({
          id: `post-${p.id}`,
          label: p.title_ar,
          hint: <StatusBadge status={p.status} />,
          icon: <FileText aria-hidden />,
          href: `/admin/posts/${p.id}`,
        }))
      : [];
  const sections = [
    { title: "إجراءات", items: actions },
    { title: "الصفحات", items: pages },
    { title: "المنشورات", items: postItems },
  ].filter((s) => s.items.length);
  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-5 shrink-0 text-text-muted" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, flat.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(flat[current]);
            }
          }}
          placeholder="ابحث عن صفحة أو عنوان منشور…"
          className="h-14 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={flat[current] ? `pal-${flat[current].id}` : undefined}
        />
        {searching && <Loader2 className="size-4 animate-spin text-text-muted" aria-label="جارٍ البحث" />}
      </div>
      <div id="palette-list" role="listbox" className="overflow-y-auto p-2">
        {flat.length === 0 && !searching && (
          <p className="px-3 py-8 text-center text-sm text-text-muted">لا نتائج لـ «{q}»</p>
        )}
        {sections.map((s) => (
          <div key={s.title} className="mb-1">
            <p className="px-3 pb-1 pt-2 text-xs font-bold text-text-muted">{s.title}</p>
            {s.items.map((item) => {
              const idx = flat.indexOf(item);
              const isActive = idx === current;
              return (
                <div
                  key={item.id}
                  id={`pal-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(idx)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
                    isActive ? "bg-primary-100 text-primary-700" : "text-text",
                  )}
                >
                  <span className={isActive ? "text-primary-600" : "text-text-muted"}>{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint}
                  {isActive && <CornerDownLeft className="text-primary-500 rtl:-scale-x-100" aria-hidden />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
