"use client";

import { Eye, FileText, FileUp, MoreVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { IndexBadge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { CONTENT_TYPE_LABELS, formatRelative, postIndexState, STATUS_LABELS } from "@/lib/format";
import type { PostListItem, PostPage, Section } from "@/lib/types";
import { useApi, useDebounced } from "@/lib/use-api";

const PAGE_SIZE = 20;
const FILTER_KEYS = ["section_id", "status", "content_type", "lang", "q"] as const;

export default function PostsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <PostsList />
    </Suspense>
  );
}

function PostsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { refreshCounts } = useShell();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<
    (typeof FILTER_KEYS)[number],
    string
  >;

  const [q, setQ] = useState(filters.q);
  const debouncedQ = useDebounced(q, 350);

  const setParams = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (debouncedQ.trim() !== filters.q) setParams({ q: debouncedQ.trim() });
    // setParams يتغير مع كل عرض؛ نريد التزامن مع قيمة البحث فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const sections = useApi<Section[]>("/api/admin/sections");
  const posts = useApi<PostPage>("/api/admin/posts", { ...filters, page, page_size: PAGE_SIZE });
  const sectionName = useMemo(
    () => new Map((sections.data ?? []).map((s) => [s.id, s.name_ar])),
    [sections.data],
  );
  const [deleting, setDeleting] = useState<PostListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/posts/${deleting.id}`, { method: "DELETE" });
      toast.success(`حُذف المنشور «${deleting.title_ar}»`);
      setDeleting(null);
      posts.reload();
      refreshCounts();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<PostListItem>[] = [
    {
      key: "title",
      header: "العنوان",
      primary: true,
      cell: (p) => (
        <Link href={`/admin/posts/${p.id}`} className="group block min-w-0 max-w-md">
          <span className="block truncate text-[15px] font-bold text-text group-hover:text-primary-600">{p.title_ar}</span>
          {p.title_en && (
            <span className="block truncate text-xs text-text-muted" lang="en" dir="ltr">
              {p.title_en}
            </span>
          )}
        </Link>
      ),
    },
    {
      key: "section",
      header: "القسم",
      cell: (p) => <span className="text-text-secondary">{sectionName.get(p.section_id) ?? "—"}</span>,
    },
    {
      key: "type",
      header: "النوع",
      cell: (p) => <span className="whitespace-nowrap text-text-secondary">{CONTENT_TYPE_LABELS[p.content_type]}</span>,
    },
    { key: "status", header: "الحالة", cell: (p) => <StatusBadge status={p.status} /> },
    { key: "index", header: "الفهرسة", cell: (p) => <IndexBadge state={postIndexState(p)} /> },
    {
      key: "updated",
      header: "آخر تعديل",
      cell: (p) => <span className="whitespace-nowrap text-text-muted">{formatRelative(p.updated_at)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      actions: true,
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`إجراءات المنشور ${p.title_ar}`}>
              <MoreVertical className="!size-[18px]" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => router.push(`/admin/posts/${p.id}`)}>
              <Pencil aria-hidden />
              تعديل
            </DropdownMenuItem>
            {p.status === "published" && (
              <DropdownMenuItem onSelect={() => window.open(`/posts/${p.slug}`, "_blank", "noopener")}>
                <Eye aria-hidden />
                عرض في الموقع
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => setDeleting(p)}>
              <Trash2 aria-hidden />
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المنشورات"
        actions={
          <>
            <Link href="/admin/posts/import" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              <FileUp aria-hidden />
              استيراد
            </Link>
            <Link href="/admin/posts/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              منشور جديد
            </Link>
          </>
        }
      />

      <div role="search" className="mb-5 rounded-lg border border-border bg-surface p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-[42px] min-w-0 flex-[1_1_260px] items-center gap-2 rounded-[10px] border border-border px-3 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
            <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
            <span className="sr-only">ابحث في المنشورات</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالعنوان..."
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-muted"
              type="search"
            />
          </label>
          <FilterSelect label="القسم" value={filters.section_id} onChange={(v) => setParams({ section_id: v })}>
            <option value="">كل الأقسام</option>
            {sections.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="الحالة" value={filters.status} onChange={(v) => setParams({ status: v })}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="النوع" value={filters.content_type} onChange={(v) => setParams({ content_type: v })}>
            <option value="">كل الأنواع</option>
            {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="اللغة" value={filters.lang} onChange={(v) => setParams({ lang: v })}>
            <option value="">كل اللغات</option>
            <option value="en">له نسخة إنجليزية</option>
            <option value="ar_only">عربي فقط</option>
          </FilterSelect>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-text-secondary">
            <span aria-live="polite">{posts.data ? `${posts.data.total} نتيجة` : "…"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                router.replace(pathname, { scroll: false });
              }}
            >
              <X aria-hidden />
              مسح الفلاتر
            </Button>
          </div>
        )}
      </div>

      {posts.error ? (
        <Card>
          <ErrorState message={posts.error.message} onRetry={posts.reload} />
        </Card>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={posts.data?.items}
            rowKey={(p) => p.id}
            loading={posts.loading}
            caption="المنشورات"
            empty={
              hasFilters ? (
                <EmptyState icon={<Search />} title="لا نتائج مطابقة" description="جرّب تغيير الفلاتر أو كلمات البحث." />
              ) : (
                <EmptyState
                  icon={<FileText />}
                  title="لا توجد منشورات بعد"
                  description="أضف أول مادة معتمدة لتظهر في الموقع ويستخدمها المساعد بعد نشرها."
                  action={
                    <Link href="/admin/posts/new" className={buttonVariants()}>
                      <Plus aria-hidden />
                      منشور جديد
                    </Link>
                  }
                />
              )
            }
          />
          {posts.data && (
            <Pagination
              className="mt-4"
              page={page}
              pageSize={PAGE_SIZE}
              total={posts.data.total}
              onPageChange={(p) => setParams({ page: String(p) }, false)}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="حذف المنشور؟"
        description="سيُحذف المنشور ومقاطعه المفهرسة نهائياً، ولن يستخدمه المساعد بعد الآن."
        itemName={deleting?.title_ar}
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-[1_1_140px] sm:flex-none">
      <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-[42px] text-sm sm:w-auto sm:min-w-36">
        {children}
      </Select>
    </div>
  );
}
