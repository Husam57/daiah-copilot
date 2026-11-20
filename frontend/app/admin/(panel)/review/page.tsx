"use client";

import { ClipboardCheck, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { CONTENT_TYPE_LABELS, formatRelative } from "@/lib/format";
import type { PostListItem, PostPage, Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReviewListPage() {
  const router = useRouter();
  const posts = useApi<PostPage>("/api/admin/posts", { status: "review", page_size: 100 });
  const sections = useApi<Section[]>("/api/admin/sections");
  const sectionName = useMemo(() => new Map((sections.data ?? []).map((s) => [s.id, s.name_ar])), [sections.data]);

  const columns: Column<PostListItem>[] = [
    {
      key: "title",
      header: "العنوان",
      primary: true,
      cell: (p) => (
        <div className="min-w-0 max-w-lg">
          <p className="truncate font-bold text-text">{p.title_ar}</p>
          {p.summary_ar && <p className="truncate text-xs text-text-muted">{p.summary_ar}</p>}
        </div>
      ),
    },
    { key: "section", header: "القسم", cell: (p) => <span className="text-text-secondary">{sectionName.get(p.section_id) ?? "—"}</span> },
    { key: "type", header: "النوع", cell: (p) => <Badge variant="outline">{CONTENT_TYPE_LABELS[p.content_type]}</Badge> },
    { key: "source", header: "المصدر", hideOnMobile: true, cell: (p) => <span className="text-text-secondary">{p.source_name || "—"}</span> },
    { key: "updated", header: "أُرسل", cell: (p) => <span className="whitespace-nowrap text-text-muted">{formatRelative(p.updated_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      actions: true,
      cell: (p) => (
        <Link href={`/admin/review/${p.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Eye aria-hidden />
          مراجعة
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المراجعة"
        description="منشورات تنتظر الاعتماد. اعتمدها لتُنشر ويستخدمها المساعد، أو أرجعها للتعديل مع ملاحظة."
      />
      {posts.error ? (
        <Card>
          <ErrorState message={posts.error.message} onRetry={posts.reload} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={posts.data?.items}
          rowKey={(p) => p.id}
          loading={posts.loading}
          onRowClick={(p) => router.push(`/admin/review/${p.id}`)}
          caption="منشورات قيد المراجعة"
          empty={
            <EmptyState
              icon={<ClipboardCheck />}
              title="لا منشورات قيد المراجعة"
              description="عندما يُرسل منشور للمراجعة من المحرر سيظهر هنا."
            />
          }
        />
      )}
    </>
  );
}
