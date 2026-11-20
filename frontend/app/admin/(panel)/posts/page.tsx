"use client";

import { FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge, IndexBadge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
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
          <span className="block truncate font-bold text-text group-hover:text-primary-600">{p.title_ar}</span>
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
    { key: "type", header: "النوع", cell: (p) => <Badge variant="outline">{CONTENT_TYPE_LABELS[p.content_type]}</Badge> },
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
        <div className="flex items-center gap-1">
          <Link href={`/admin/posts/${p.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Pencil aria-hidden />
            تعديل
          </Link>
          <Button variant="danger-ghost" size="icon-sm" onClick={() => setDeleting(p)} aria-label={`حذف ${p.title_ar}`}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المنشورات"
        description="كل المواد بحالاتها. المنشورة فقط يستخدمها المساعد كمصدر."
        actions={
          <Link href="/admin/posts/new" className={buttonVariants()}>
            <Plus aria-hidden />
            منشور جديد
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في العنوان والملخص…"
              className="ps-9"
              aria-label="بحث في المنشورات"
              type="search"
            />
          </div>
          <Select aria-label="القسم" value={filters.section_id} onChange={(e) => setParams({ section_id: e.target.value })}>
            <option value="">كل الأقسام</option>
            {sections.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </Select>
          <Select aria-label="الحالة" value={filters.status} onChange={(e) => setParams({ status: e.target.value })}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select aria-label="النوع" value={filters.content_type} onChange={(e) => setParams({ content_type: e.target.value })}>
            <option value="">كل الأنواع</option>
            {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select aria-label="اللغة" value={filters.lang} onChange={(e) => setParams({ lang: e.target.value })}>
            <option value="">كل اللغات</option>
            <option value="en">له نسخة إنجليزية</option>
            <option value="ar_only">عربي فقط</option>
          </Select>
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
      </Card>

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
