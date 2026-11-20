"use client";

import { CheckCircle2, EyeOff, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { CATEGORY_LABELS, formatDate, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type { UnansweredGroup } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { safeStorage } from "@/lib/utils";

/** "تجاهل" محلي لكل متصفح (لا يوجد عمود في chat_logs لذلك؛ لا نحذف السجلات). */
const IGNORE_KEY = "daiah.unanswered.ignored";

function readIgnored(): string[] {
  try {
    const v = JSON.parse(safeStorage.get(IGNORE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function UnansweredPage() {
  const { data, error, loading, reload } = useApi<UnansweredGroup[]>("/api/admin/ai/unanswered", { limit: 200 });
  const [ignored, setIgnored] = useState<string[]>(readIgnored);
  const [showIgnored, setShowIgnored] = useState(false);

  const persist = (next: string[]) => {
    setIgnored(next);
    safeStorage.set(IGNORE_KEY, JSON.stringify(next));
  };
  const rows = useMemo(
    () => (data ?? []).filter((g) => (showIgnored ? ignored.includes(g.question) : !ignored.includes(g.question))),
    [data, ignored, showIgnored],
  );
  const ignoredCount = (data ?? []).filter((g) => ignored.includes(g.question)).length;

  const columns: Column<UnansweredGroup>[] = [
    {
      key: "q",
      header: "السؤال",
      primary: true,
      cell: (g) => (
        <p className="max-w-md font-medium text-text" dir="auto">
          {g.question}
        </p>
      ),
    },
    {
      key: "date",
      header: "آخر مرة",
      cell: (g) => (
        <span className="whitespace-nowrap text-text-muted" title={formatDate(g.last_at)}>
          {formatRelative(g.last_at)}
        </span>
      ),
    },
    {
      key: "cat",
      header: "التصنيف",
      cell: (g) => (g.category ? <Badge variant="primary">{CATEGORY_LABELS[g.category]}</Badge> : <Badge>غير مصنّف</Badge>),
    },
    {
      key: "closest",
      header: "أقرب مادة",
      cell: (g) =>
        g.closest ? (
          <Link href={`/admin/posts/${g.closest.id}`} className="block max-w-56 hover:text-primary-600">
            <span className="block truncate">{g.closest.title_ar}</span>
            <span className="text-xs text-text-muted" dir="ltr">
              {formatPercent(g.closest.similarity)}
            </span>
          </Link>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "count",
      header: "التكرار",
      cell: (g) => <Badge variant={g.count > 1 ? "warning" : "neutral"}>{formatNumber(g.count)}×</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      actions: true,
      cell: (g) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/posts/new?title=${encodeURIComponent(g.question)}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Plus aria-hidden />
            أنشئ منشوراً
          </Link>
          {showIgnored ? (
            <Button variant="ghost" size="sm" onClick={() => persist(ignored.filter((q) => q !== g.question))}>
              <RotateCcw aria-hidden />
              إعادة
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                persist([...ignored, g.question]);
                toast.info("أُخفي السؤال من القائمة");
              }}
            >
              <EyeOff aria-hidden />
              تجاهل
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الأسئلة غير المجابة"
        description="أسئلة المستخدمين التي لم يجد لها المساعد مادة فوق العتبة، مجمّعة حسب النص. أنشئ لها محتوى معتمداً."
        actions={
          ignoredCount > 0 || showIgnored ? (
            <Button variant="ghost" onClick={() => setShowIgnored((s) => !s)}>
              {showIgnored ? "عرض الأسئلة النشطة" : `المتجاهلة (${formatNumber(ignoredCount)})`}
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(g) => g.question}
          loading={loading}
          caption="الأسئلة غير المجابة"
          empty={
            <EmptyState
              icon={<CheckCircle2 />}
              title={showIgnored ? "لا أسئلة متجاهلة" : "لا أسئلة غير مجابة"}
              description={showIgnored ? undefined : "كل أسئلة المستخدمين وجدت مادة معتمدة مناسبة."}
            />
          }
        />
      )}
    </>
  );
}
