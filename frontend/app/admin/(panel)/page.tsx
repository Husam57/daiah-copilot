"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  FolderClosed,
  History,
  MessageCircleQuestion,
  MessageSquare,
  Plus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QuestionsChart } from "@/components/admin/questions-chart";
import { useShell } from "@/components/admin/shell-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { StatCard, StatusDot } from "@/components/ui/status";
import { useAuth } from "@/lib/auth";
import { ACTIVITY_LABELS, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import type { ActivityEvent, ActivityType, DashboardStats, UnansweredGroup } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/** لون نقطة النشاط كما في AdminDashboard.dc.html */
const ACTIVITY_DOT: Record<ActivityType, string> = {
  post_published: "bg-success",
  post_review: "bg-warning",
  post_saved: "bg-info",
  settings_updated: "bg-primary-700",
  index_updated: "bg-primary-700",
};

/** رأس بطاقة اللوحة: عنوان 18px وعنصر في جهة النهاية. */
function PanelHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold leading-7">{title}</h2>
      {aside}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useApi<DashboardStats>("/api/admin/dashboard/stats");
  const activity = useApi<ActivityEvent[]>("/api/admin/dashboard/activity", { limit: 8 });
  const unanswered = useApi<UnansweredGroup[]>("/api/admin/ai/unanswered", { limit: 5 });
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title={`أهلاً، ${user?.name ?? ""}`}
        description="نظرة سريعة على المحتوى والمساعد."
        actions={
          <Link href="/admin/posts/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            منشور جديد
          </Link>
        }
      />

      {stats.error ? (
        <Card>
          <ErrorState message={stats.error.message} onRetry={stats.reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={<FolderClosed />}
            label="الأقسام"
            value={formatNumber(s?.sections)}
            hint={s && `${formatNumber(s.sections_active)} مفعّل`}
            loading={stats.loading}
          />
          <StatCard icon={<FileText />} label="كل المنشورات" value={formatNumber(s?.posts_total)} loading={stats.loading} />
          <StatCard
            icon={<CheckCircle2 />}
            tone="success"
            label="منشورة"
            value={formatNumber(s?.posts_by_status.published)}
            hint={s && `${formatNumber(s.posts_indexed)} مفهرس`}
            loading={stats.loading}
          />
          <StatCard
            icon={<Clock />}
            tone="warning"
            label="قيد المراجعة"
            value={formatNumber(s?.posts_by_status.review)}
            hint={s && `${formatNumber(s.posts_by_status.draft)} مسودة`}
            loading={stats.loading}
          />
          <StatCard
            icon={<MessageSquare />}
            tone="info"
            label="أسئلة اليوم"
            value={formatNumber(s?.questions_today)}
            hint={s && `${formatNumber(s.questions_total)} إجمالاً`}
            loading={stats.loading}
          />
          <StatCard
            icon={<MessageCircleQuestion />}
            tone="danger"
            label="نسبة غير المجابة"
            value={formatPercent(s?.fallback_rate_today)}
            hint={s && `اليوم · ${formatPercent(s.fallback_rate_total)} إجمالاً`}
            loading={stats.loading}
          />
        </div>
      )}

      <QuestionsChart />

      <div className="flex flex-wrap items-start gap-6">
        <SystemStatusCard className="min-w-0 flex-[1_1_320px]" />

        <Card className="flex min-w-0 flex-[2_1_420px] flex-col gap-1 p-[22px]">
          <div className="mb-2.5">
            <PanelHead title="آخر النشاطات" />
          </div>
          {activity.loading ? (
            <ul className="space-y-4 py-2">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex gap-3.5">
                  <Skeleton className="mt-1.5 size-2.5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </li>
              ))}
            </ul>
          ) : activity.error ? (
            <ErrorState compact message={activity.error.message} onRetry={activity.reload} />
          ) : !activity.data?.length ? (
            <EmptyState icon={<History />} title="لا نشاط بعد" description="ستظهر هنا عمليات النشر والفهرسة وتعديل التعليمات." />
          ) : (
            <ol>
              {activity.data.map((e, i) => {
                const text = (
                  <>
                    {ACTIVITY_LABELS[e.type]}
                    {e.title && <> «{e.title}»</>}
                    {e.version && <> (الإصدار {formatNumber(e.version)})</>}
                  </>
                );
                const href = e.post_id ? `/admin/posts/${e.post_id}` : e.type === "settings_updated" ? "/admin/ai/settings" : null;
                return (
                  <li key={`${e.type}-${e.at}-${i}`} className="flex items-start gap-3.5 border-b border-border-subtle py-2.5 last:border-b-0">
                    <span className={cn("mt-[7px] size-2.5 shrink-0 rounded-full", ACTIVITY_DOT[e.type])} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {href ? (
                        <Link href={href} className="text-[15px] hover:text-primary-600">
                          {text}
                        </Link>
                      ) : (
                        <span className="text-[15px]">{text}</span>
                      )}
                      <span className="text-xs text-text-muted">{formatRelative(e.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-[22px]">
        <PanelHead
          title="أكثر الأسئلة غير المجابة"
          aside={
            <Link href="/admin/ai/unanswered" className="text-sm font-bold text-primary-600 hover:text-primary-700">
              عرض الكل
            </Link>
          }
        />
        {unanswered.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : unanswered.error ? (
          <ErrorState compact message={unanswered.error.message} onRetry={unanswered.reload} />
        ) : !unanswered.data?.length ? (
          <EmptyState icon={<CheckCircle2 />} title="لا أسئلة غير مجابة" description="كل الأسئلة وجدت مادة معتمدة مناسبة." />
        ) : (
          <ul className="flex flex-col gap-3">
            {unanswered.data.map((q) => (
              <li
                key={q.question}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle px-3.5 py-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-medium" dir="auto">
                    {q.question}
                  </span>
                  <span className="text-xs text-text-muted">
                    تكرر {formatNumber(q.count)} {q.count === 1 ? "مرة" : q.count <= 10 ? "مرات" : "مرة"}
                  </span>
                </span>
                <Link
                  href={`/admin/posts/new?title=${encodeURIComponent(q.question)}`}
                  className={buttonVariants({ variant: "soft", size: "sm" })}
                >
                  أنشئ منشوراً
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SystemStatusCard({ className }: { className?: string }) {
  const { system, systemError, refreshSystem } = useShell();
  const [checking, setChecking] = useState(false);
  return (
    <Card className={cn("flex scroll-mt-24 flex-col gap-3.5 p-[22px]", className)} id="system">
      <PanelHead
        title="حالة النظام"
        aside={
          <span className="flex items-center gap-1 text-xs text-text-muted">
            {system && <>آخر فحص: {formatRelative(system.checked_at)}</>}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8"
              loading={checking}
              aria-label="فحص الآن"
              title="فحص الآن"
              onClick={async () => {
                setChecking(true);
                await refreshSystem(true);
                setChecking(false);
              }}
            >
              {!checking && <RefreshCw aria-hidden />}
            </Button>
          </span>
        }
      />
      {systemError && !system ? (
        <ErrorState compact message="تعذّر فحص حالة النظام — تأكد أن الـ Backend يعمل." onRetry={() => refreshSystem(true)} />
      ) : !system ? (
        <ul className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {system.items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-md bg-bg px-3.5 py-3"
              title={`${item.detail}${item.latency_ms !== undefined ? ` · ${item.latency_ms} ms` : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{item.label}</span>
                <span className="block truncate text-xs text-text-muted">{item.detail}</span>
              </span>
              <StatusDot state={item.state} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
