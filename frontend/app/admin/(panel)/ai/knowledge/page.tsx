"use client";

import { Clock, Database, FileStack, Hammer, History, Layers, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { IndexBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Alert, EmptyState, ErrorState, ProgressBar } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { StatCard, StatusDot } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import type { IndexStatus, IndexStatusItem, PostWithIndex, ReindexResult } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface OpLog {
  at: string;
  text: string;
  ok: boolean;
}

export default function KnowledgePage() {
  const status = useApi<IndexStatus>("/api/admin/ai/index-status");
  const { refreshSystem } = useShell();
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [ops, setOps] = useState<OpLog[]>([]);
  const s = status.data;

  const log = (text: string, ok = true) => setOps((o) => [{ at: new Date().toISOString(), text, ok }, ...o].slice(0, 20));

  const reindexOne = async (item: IndexStatusItem) => {
    setRowBusy(item.post_id);
    try {
      const res = await api<PostWithIndex>(`/api/admin/posts/${item.post_id}/reindex`, { method: "POST" });
      toast.success(`أُعيدت فهرسة «${item.title_ar}» (${res.chunks ?? 0} مقطع)`);
      log(`إعادة فهرسة «${item.title_ar}» — ${res.chunks ?? 0} مقطع`);
      status.reload();
      void refreshSystem(true);
    } catch (e) {
      toast.error(errorMessage(e));
      log(`فشلت فهرسة «${item.title_ar}»: ${errorMessage(e)}`, false);
    } finally {
      setRowBusy(null);
    }
  };

  const rebuild = async () => {
    setConfirm(false);
    setRebuilding(true);
    const t0 = Date.now();
    try {
      const res = await api<ReindexResult>("/api/admin/ai/reindex", { method: "POST" });
      const secs = Math.round((Date.now() - t0) / 1000);
      const msg = `أُعيد بناء الفهرس: ${res.indexed}/${res.total_published} منشور، ${res.chunks} مقطع (${secs} ث)`;
      if (res.failed.length) {
        toast.warning(`${msg} — فشل ${res.failed.length}`);
        log(`${msg} — فشل ${res.failed.length}`, false);
      } else {
        toast.success(msg);
        log(msg);
      }
      status.reload();
      void refreshSystem(true);
    } catch (e) {
      toast.error(errorMessage(e));
      log(`فشلت إعادة البناء: ${errorMessage(e)}`, false);
    } finally {
      setRebuilding(false);
    }
  };

  const health =
    !s ? "unknown" : s.published === 0 ? "warning" : s.pending + s.stale > 0 || s.orphan_chunk_posts > 0 ? "warning" : "ok";
  const healthLabel =
    !s
      ? "…"
      : s.published === 0
        ? "الفهرس فارغ"
        : health === "ok"
          ? "محدّث بالكامل"
          : `${s.pending} بانتظار · ${s.stale} يحتاج تحديث`;

  const columns: Column<IndexStatusItem>[] = [
    {
      key: "title",
      header: "المنشور",
      primary: true,
      cell: (i) => (
        <Link href={`/admin/posts/${i.post_id}`} className="block max-w-md truncate font-bold hover:text-primary-600">
          {i.title_ar}
        </Link>
      ),
    },
    { key: "state", header: "الحالة", cell: (i) => <IndexBadge state={i.state} /> },
    {
      key: "chunks",
      header: "المقاطع (ع / En)",
      cell: (i) => (
        <span className="tabular-nums text-text-secondary">
          {formatNumber(i.chunks_ar)} / {formatNumber(i.chunks_en)}
        </span>
      ),
    },
    {
      key: "indexed",
      header: "آخر فهرسة",
      cell: (i) => <span className="whitespace-nowrap text-text-muted">{formatRelative(i.indexed_at)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      actions: true,
      cell: (i) => (
        <Button
          variant={i.state === "indexed" ? "ghost" : "secondary"}
          size="sm"
          loading={rowBusy === i.post_id}
          disabled={rebuilding || (rowBusy !== null && rowBusy !== i.post_id)}
          onClick={() => reindexOne(i)}
        >
          {rowBusy !== i.post_id && <RefreshCw aria-hidden />}
          إعادة فهرسة
        </Button>
      ),
    },
  ];

  const recent = (s?.items ?? [])
    .filter((i) => i.indexed_at)
    .sort((a, b) => (b.indexed_at ?? "").localeCompare(a.indexed_at ?? ""))
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="قاعدة المعرفة (RAG)"
        description="المنشورات المنشورة فقط تُقسَّم إلى مقاطع وتُفهرس بالمتجهات ليبحث فيها المساعد."
        actions={
          <Button onClick={() => setConfirm(true)} disabled={rebuilding || !s}>
            <Hammer aria-hidden />
            إعادة بناء الفهرس بالكامل
          </Button>
        }
      />

      {status.error ? (
        <Card>
          <ErrorState message={status.error.message} onRetry={status.reload} />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              icon={<FileStack />}
              label="منشورات مفهرسة / المنشورة"
              value={s ? `${formatNumber(s.indexed)} / ${formatNumber(s.published)}` : "—"}
              hint={s && `${formatNumber(s.total_posts)} منشور بكل الحالات`}
              loading={status.loading}
            />
            <StatCard
              icon={<Layers />}
              label="عدد المقاطع"
              value={formatNumber(s?.total_chunks)}
              hint={s && `${s.embedding_model} · ${s.embedding_dim} بُعداً`}
              loading={status.loading}
            />
            <StatCard
              icon={<Clock />}
              label="آخر فهرسة"
              value={<span className="text-h3">{s?.last_indexed_at ? formatRelative(s.last_indexed_at) : "—"}</span>}
              hint={s?.last_indexed_at && formatDate(s.last_indexed_at)}
              loading={status.loading}
            />
            <StatCard
              icon={<Database />}
              label="حالة الفهرس"
              value={<StatusDot state={health} label={healthLabel} className="text-body font-bold" />}
              loading={status.loading}
            />
          </div>

          {s && s.orphan_chunk_posts > 0 && (
            <Alert variant="warning" className="mb-4">
              توجد مقاطع لـ {s.orphan_chunk_posts} منشور غير منشور. «إعادة بناء الفهرس» تنظّفها.
            </Alert>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <DataTable
                columns={columns}
                rows={s?.items}
                rowKey={(i) => i.post_id}
                loading={status.loading}
                caption="حالة فهرسة المنشورات المنشورة"
                empty={
                  <EmptyState
                    icon={<Database />}
                    title="الفهرس فارغ"
                    description="انشر أول منشور ليُفهرس تلقائياً ويصبح مصدراً للمساعد."
                  />
                }
              />
            </div>
            <Card className="self-start">
              <CardHeader title="سجل عمليات الفهرسة" icon={<History />} />
              <ul className="divide-y divide-border text-sm">
                {ops.map((o) => (
                  <li key={o.at + o.text} className="px-5 py-3">
                    <StatusDot state={o.ok ? "ok" : "down"} label={o.text} className="items-start [&>span:first-child]:mt-2" />
                    <p className="ms-4 text-xs text-text-muted">{formatRelative(o.at)} · هذه الجلسة</p>
                  </li>
                ))}
                {recent.map((i) => (
                  <li key={`r-${i.post_id}`} className="px-5 py-3">
                    <p className="truncate">فُهرس «{i.title_ar}»</p>
                    <p className="text-xs text-text-muted">
                      {formatRelative(i.indexed_at)} · {formatNumber(i.chunks_ar + i.chunks_en)} مقطع
                    </p>
                  </li>
                ))}
                {!ops.length && !recent.length && (
                  <li className="px-5 py-8 text-center text-text-muted">لا عمليات فهرسة بعد.</li>
                )}
              </ul>
            </Card>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="إعادة بناء الفهرس بالكامل؟"
        description={`ستُعاد فهرسة كل المنشورات المنشورة (${s?.published ?? 0}) عبر Gemini، وتُحذف مقاطع غير المنشورة. قد يستغرق ذلك دقائق ويستهلك حصة الـ API.`}
        confirmLabel="إعادة البناء"
        variant="primary"
        onConfirm={rebuild}
      />

      <Dialog open={rebuilding}>
        <DialogContent
          title="جارٍ إعادة بناء الفهرس…"
          description="لا تغلق الصفحة. تُحسب الـ embeddings لكل منشور منشور."
          hideClose
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <ProgressBar label="تقدم إعادة البناء" />
          <p className="mt-3 text-sm text-text-muted">{formatNumber(s?.published ?? 0)} منشور</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
