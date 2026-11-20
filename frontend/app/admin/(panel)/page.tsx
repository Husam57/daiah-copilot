"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  FilePen,
  FileText,
  FolderTree,
  History,
  MessageCircleQuestion,
  Percent,
  Plus,
  RefreshCw,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { StatCard, StatusDot } from "@/components/ui/status";
import { useAuth } from "@/lib/auth";
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  formatNumber,
  formatPercent,
  formatRelative,
} from "@/lib/format";
import type { ActivityEvent, ActivityType, DashboardStats, UnansweredGroup } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  post_published: CheckCircle2,
  index_updated: Database,
  post_saved: FilePen,
  post_review: Send,
  settings_updated: SlidersHorizontal,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useApi<DashboardStats>("/api/admin/dashboard/stats");
  const activity = useApi<ActivityEvent[]>("/api/admin/dashboard/activity", { limit: 10 });
  const unanswered = useApi<UnansweredGroup[]>("/api/admin/ai/unanswered", { limit: 5 });
  const s = stats.data;

  return (
    <>
      <PageHeader
        title={`أهلاً، ${user?.name ?? ""}`}
        description="نظرة عامة على المحتوى والمساعد."
        actions={
          <Link href="/admin/posts/new" className={buttonVariants()}>
            <Plus aria-hidden />
            منشور جديد
          </Link>
        }
      />

      {stats.error ? (
        <Card className="mb-6">
          <ErrorState message={stats.error.message} onRetry={stats.reload} />
        </Card>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={<FolderTree />}
            label="الأقسام"
            value={formatNumber(s?.sections)}
            hint={s && `${formatNumber(s.sections_active)} مفعّل`}
            loading={stats.loading}
          />
          <StatCard icon={<FileText />} label="المنشورات" value={formatNumber(s?.posts_total)} loading={stats.loading} />
          <StatCard
            icon={<CheckCircle2 />}
            label="منشورة"
            value={formatNumber(s?.posts_by_status.published)}
            hint={s && `${formatNumber(s.posts_indexed)} مفهرس`}
            loading={stats.loading}
          />
          <StatCard
            icon={<ClipboardCheck />}
            label="قيد المراجعة"
            value={formatNumber(s?.posts_by_status.review)}
            hint={s && `${formatNumber(s.posts_by_status.draft)} مسودة`}
            loading={stats.loading}
          />
          <StatCard
            icon={<MessageCircleQuestion />}
            label="أسئلة اليوم"
            value={formatNumber(s?.questions_today)}
            hint={s && `${formatNumber(s.questions_total)} إجمالاً`}
            loading={stats.loading}
          />
          <StatCard
            icon={<Percent />}
            label="غير المجابة اليوم"
            value={formatPercent(s?.fallback_rate_today)}
            hint={s && `${formatPercent(s.fallback_rate_total)} إجمالاً`}
            highlight
            loading={stats.loading}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <SystemStatusCard className="lg:col-span-2" />

        <Card className="lg:col-span-3">
          <CardHeader title="آخر النشاطات" icon={<History />} />
          {activity.loading ? (
            <ul className="space-y-4 p-5">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-full" />
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
            <ol className="relative space-y-1 p-3">
              {activity.data.map((e, i) => {
                const Icon = ACTIVITY_ICON[e.type];
                const content = (
                  <>
                    <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-primary-600">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-bold text-text">{ACTIVITY_LABELS[e.type]}</span>
                        {e.title && <span className="text-text-secondary"> — {e.title}</span>}
                        {e.version && <span className="text-text-secondary"> — الإصدار {formatNumber(e.version)}</span>}
                      </span>
                      <span className="block text-xs text-text-muted">{formatRelative(e.at)}</span>
                    </span>
                  </>
                );
                const href = e.post_id ? `/admin/posts/${e.post_id}` : e.type === "settings_updated" ? "/admin/ai/settings" : null;
                return (
                  <li key={`${e.type}-${e.at}-${i}`}>
                    {href ? (
                      <Link href={href} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-bg">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 px-2 py-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="أكثر الأسئلة غير المجابة"
          description="أسئلة لم يجد لها المساعد مادة فوق العتبة — فرصة لإضافة محتوى."
          icon={<MessageCircleQuestion />}
          actions={
            <Link href="/admin/ai/unanswered" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              عرض الكل
            </Link>
          }
        />
        {unanswered.loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : unanswered.error ? (
          <ErrorState compact message={unanswered.error.message} onRetry={unanswered.reload} />
        ) : !unanswered.data?.length ? (
          <EmptyState icon={<CheckCircle2 />} title="لا أسئلة غير مجابة" description="كل الأسئلة وجدت مادة معتمدة مناسبة." />
        ) : (
          <ul className="divide-y divide-border">
            {unanswered.data.map((q) => (
              <li key={q.question} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text" dir="auto">
                    {q.question}
                  </p>
                  <p className="text-xs text-text-muted">
                    {q.category ? CATEGORY_LABELS[q.category] : "غير مصنّف"} · آخر مرة {formatRelative(q.last_at)}
                  </p>
                </div>
                <Badge variant="warning">تكرر {formatNumber(q.count)}×</Badge>
                <Link
                  href={`/admin/posts/new?title=${encodeURIComponent(q.question)}`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  <Plus aria-hidden />
                  أنشئ منشوراً
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function SystemStatusCard({ className }: { className?: string }) {
  const { system, systemError, refreshSystem } = useShell();
  const [checking, setChecking] = useState(false);
  return (
    <Card className={cn("scroll-mt-24", className)} id="system">
      <CardHeader
        title="حالة النظام"
        description={system ? `آخر فحص: ${formatRelative(system.checked_at)}` : undefined}
        icon={<Database />}
        actions={
          <Button
            variant="ghost"
            size="sm"
            loading={checking}
            onClick={async () => {
              setChecking(true);
              await refreshSystem(true);
              setChecking(false);
            }}
          >
            {!checking && <RefreshCw aria-hidden />}
            فحص الآن
          </Button>
        }
      />
      {systemError && !system ? (
        <ErrorState compact message="تعذّر فحص حالة النظام — تأكد أن الـ Backend يعمل." onRetry={() => refreshSystem(true)} />
      ) : !system ? (
        <ul className="space-y-4 p-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-border">
          {system.items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-medium text-text">{item.label}</p>
                <p className="truncate text-xs text-text-muted">
                  {item.detail}
                  {item.latency_ms !== undefined && ` · ${formatNumber(item.latency_ms)} ms`}
                </p>
              </div>
              <StatusDot state={item.state} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
