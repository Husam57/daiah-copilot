"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, formatDate, formatNumber, formatRelative, formatScore } from "@/lib/format";
import type { UnansweredGroup } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Period = "7d" | "30d" | "all";
const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "آخر ٧ أيام" },
  { value: "30d", label: "آخر ٣٠ يوماً" },
  { value: "all", label: "الكل" },
];

function timesLabel(n: number): string {
  if (n === 1) return "مرة";
  if (n === 2) return "مرتان";
  return `${formatNumber(n)} ${n <= 10 ? "مرات" : "مرة"}`;
}

export default function UnansweredPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <UnansweredList />
    </Suspense>
  );
}

/** الأسئلة غير المجابة حسب AdminUnanswered.dc.html: السؤال · التكرار · التصنيف · أقرب مادة · آخر مرة · إجراءات. */
function UnansweredList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = (PERIODS.some((p) => p.value === params.get("period")) ? params.get("period") : "all") as Period;
  const { data, error, loading, reload, mutate } = useApi<UnansweredGroup[]>("/api/admin/ai/unanswered", {
    limit: 200,
    period,
  });
  const { refreshCounts } = useShell();
  const [busy, setBusy] = useState<string | null>(null);

  const ignore = async (g: UnansweredGroup) => {
    setBusy(g.question);
    try {
      await api("/api/admin/ai/unanswered/ignore", { method: "POST", body: { question: g.question } });
      mutate((prev) => (prev ?? []).filter((x) => x.question !== g.question));
      toast.success("تم تجاهل السؤال، ولن يظهر في القائمة ولا العدّاد");
      refreshCounts();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<UnansweredGroup>[] = [
    {
      key: "q",
      header: "السؤال",
      primary: true,
      className: "max-w-[340px]",
      cell: (g) => (
        <p className="text-[15px] font-medium text-text" dir="auto">
          {g.question}
        </p>
      ),
    },
    {
      key: "count",
      header: "التكرار",
      cell: (g) => <Badge variant="danger">{timesLabel(g.count)}</Badge>,
    },
    {
      key: "cat",
      header: "التصنيف",
      cell: (g) => <span className="text-text-secondary">{g.category ? CATEGORY_LABELS[g.category] : "غير محدد"}</span>,
    },
    {
      key: "closest",
      header: "أقرب مادة",
      cell: (g) =>
        g.closest ? (
          <Link href={`/admin/posts/${g.closest.id}`} className="flex max-w-56 flex-col gap-0.5 hover:text-primary-600">
            <span className="truncate text-text">{g.closest.title_ar}</span>
            <span className="font-en text-xs text-text-muted" lang="en">
              {formatScore(g.closest.similarity)}
            </span>
          </Link>
        ) : (
          <span className="text-text-muted">—</span>
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
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      actions: true,
      cell: (g) => (
        <span className="flex justify-end gap-1.5">
          <Link
            href={`/admin/posts/new?title=${encodeURIComponent(g.question)}`}
            className={buttonVariants({ size: "sm", className: "whitespace-nowrap" })}
          >
            أنشئ منشوراً
          </Link>
          <Button variant="secondary" size="sm" className="text-text-secondary" loading={busy === g.question} onClick={() => ignore(g)}>
            تجاهل
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title="الأسئلة غير المجابة"
        description="أسئلة لم يجد لها المساعد مادة معتمدة كافية. هذه خريطتك للمحتوى الناقص: أنشئ لها منشورات، وستُجاب تلقائياً بعد النشر."
        actions={
          <Select
            aria-label="الفترة"
            value={period}
            onChange={(e) => {
              const v = e.target.value as Period;
              router.replace(v === "all" ? pathname : `${pathname}?period=${v}`, { scroll: false });
            }}
            className="h-[42px] min-w-36 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        }
      />
      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(g) => g.question}
          loading={loading}
          caption="الأسئلة غير المجابة"
          empty={
            <EmptyState
              icon={<CheckCircle2 />}
              title="لا أسئلة غير مجابة"
              description={
                period === "all" ? "كل أسئلة المستخدمين وجدت مادة معتمدة مناسبة." : "لا أسئلة غير مجابة في هذه الفترة."
              }
            />
          }
        />
      )}
    </div>
  );
}
