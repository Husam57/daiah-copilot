"use client";

import { AlertTriangle, CheckCircle2, Download, FileJson, FileSpreadsheet, FileUp, RotateCcw, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { CATEGORY_SHORT, CONTENT_TYPE_LABELS, formatNumber } from "@/lib/format";
import type { ContentType, ImportResult, ImportRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5_000_000;
const COLUMNS = [
  "id", "category", "section_slug", "topic", "title_ar", "title_en", "content_ar", "content_en",
  "summary_ar", "tags", "external_ref", "source_name", "content_type", "file_url",
] as const;

type Format = "json" | "csv";
type TargetStatus = "draft" | "review";
type RowFilter = "all" | "valid" | "invalid";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadEmptyTemplate(format: Format) {
  if (format === "json") {
    const row = Object.fromEntries(COLUMNS.map((c) => [c, c === "tags" ? [] : ""]));
    download("daiah-content-template.json", JSON.stringify([row], null, 2) + "\n", "application/json");
  } else {
    // BOM حتى يفتحه Excel بترميز UTF-8 فتظهر العربية صحيحة
    download("daiah-content-template.csv", "﻿" + COLUMNS.join(",") + "\r\n", "text/csv;charset=utf-8");
  }
}

function detectFormat(file: File): Format | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".json")) return "json";
  if (n.endsWith(".csv")) return "csv";
  return null;
}

export default function ImportPage() {
  const { refreshCounts } = useShell();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; format: Format; content: string } | null>(null);
  const [status, setStatus] = useState<TargetStatus>("draft");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    setFilter("all");
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPreview(null);
    setDone(null);
    setError(null);
    const format = detectFormat(f);
    if (!format) {
      setFile(null);
      setError("نوع الملف غير مدعوم: اختر ملف ‎.json‎ أو ‎.csv");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setError("حجم الملف أكبر من 5 ميغابايت. قسّمه إلى أكثر من ملف.");
      return;
    }
    setFile({ name: f.name, size: f.size, format, content: await f.text() });
  };

  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "preview" : "import");
    setError(null);
    try {
      const res = await api<ImportResult>("/api/admin/posts/import", {
        method: "POST",
        body: { format: file.format, content: file.content, status, dry_run: dryRun },
      });
      if (dryRun) {
        setPreview(res);
        setFilter(res.invalid ? "invalid" : "all");
      } else {
        setDone(res);
        setPreview(null);
        toast.success(`استُورد ${formatNumber(res.created)} منشوراً`);
        refreshCounts();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      setConfirm(false);
    }
  };

  const rows = useMemo(() => {
    const all = preview?.rows ?? [];
    if (filter === "valid") return all.filter((r) => !r.errors.length);
    if (filter === "invalid") return all.filter((r) => r.errors.length);
    return all;
  }, [preview, filter]);

  const statusLabel = status === "draft" ? "مسودة" : "قيد المراجعة";

  const columns: Column<ImportRow>[] = [
    {
      key: "index",
      header: "#",
      cell: (r) => <span className="tabular-nums text-text-muted">{r.index}</span>,
      hideOnMobile: true,
    },
    {
      key: "title",
      header: "العنوان",
      primary: true,
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <span className="block truncate font-bold text-text">
            <span className="text-text-muted md:hidden">{r.index}. </span>
            {r.title_ar || <span className="font-normal text-text-muted">— بلا عنوان —</span>}
          </span>
          <span className="block truncate text-xs text-text-muted" dir="ltr" lang="en">
            {r.slug ?? "slug تلقائي"}
          </span>
        </div>
      ),
    },
    {
      key: "section",
      header: "المسار / القسم",
      cell: (r) => (
        <span className="text-text-secondary">
          {r.category ? CATEGORY_SHORT[r.category] : "—"}
          {r.section_name && <span className="block text-xs text-text-muted">{r.section_name}</span>}
        </span>
      ),
    },
    {
      key: "type",
      header: "النوع",
      cell: (r) => (
        <span className="whitespace-nowrap text-text-secondary">
          {CONTENT_TYPE_LABELS[r.content_type as ContentType] ?? r.content_type ?? "—"}
        </span>
      ),
    },
    {
      key: "lang",
      header: "اللغة",
      cell: (r) => (
        <span className="whitespace-nowrap text-text-secondary">{r.has_en ? "ع + En" : "ع"}</span>
      ),
    },
    {
      key: "check",
      header: "التحقق",
      cell: (r) => (
        <div className="flex min-w-0 max-w-md flex-col gap-1">
          {r.errors.length ? (
            r.errors.map((e) => (
              <span key={e} className="flex items-start gap-1.5 text-[13px] leading-5 text-danger-fg">
                <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {e}
              </span>
            ))
          ) : (
            <Badge variant="success" className="self-start">
              <CheckCircle2 aria-hidden />
              صالح
            </Badge>
          )}
          {r.warnings.map((w) => (
            <span key={w} className="flex items-start gap-1.5 text-[13px] leading-5 text-warning-fg">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {w}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="استيراد المحتوى"
        description="أضف عدة مواد دفعة واحدة من ملف JSON أو CSV. تُحفظ مسودات أو قيد المراجعة، ولا يُنشر شيء تلقائياً."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadEmptyTemplate("json")}>
              <FileJson aria-hidden />
              قالب JSON فارغ
            </Button>
            <Button variant="secondary" onClick={() => downloadEmptyTemplate("csv")}>
              <FileSpreadsheet aria-hidden />
              قالب CSV فارغ
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="1. اختر الملف" description="ملف واحد ‎.json‎ أو ‎.csv‎ بترميز UTF-8، حتى 500 صف و5 ميغابايت." />
          <CardBody className="flex flex-col gap-5 pt-3">
            <label
              htmlFor="import-file"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void pick(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors duration-150 focus-within:ring-2 focus-within:ring-primary-500",
                dragging ? "border-primary-500 bg-primary-50" : "border-border bg-bg hover:border-primary-500",
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-primary-100 text-primary-700">
                <FileUp className="size-6" aria-hidden />
              </span>
              {file ? (
                <>
                  <span className="font-bold text-text" dir="auto">
                    {file.name}
                  </span>
                  <span className="text-sm text-text-muted">
                    {file.format.toUpperCase()} · {formatNumber(Math.ceil(file.size / 1024))} ك.ب — اضغط لاختيار ملف آخر
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-text">اسحب الملف هنا أو اضغط للاختيار</span>
                  <span className="text-sm text-text-muted">JSON (قائمة مواد) أو CSV (صف عناوين ثم صف لكل مادة)</span>
                </>
              )}
              <input
                ref={inputRef}
                id="import-file"
                type="file"
                accept=".json,.csv,application/json,text/csv"
                className="sr-only"
                onChange={(e) => void pick(e.target.files?.[0])}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-text">الحالة بعد الاستيراد:</span>
                <Segmented<TargetStatus>
                  label="الحالة بعد الاستيراد"
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setDone(null);
                  }}
                  options={[
                    { value: "draft", label: "مسودة" },
                    { value: "review", label: "قيد المراجعة" },
                  ]}
                />
              </div>
              <div className="flex gap-2">
                {(file || preview || done) && (
                  <Button variant="ghost" onClick={reset}>
                    <RotateCcw aria-hidden />
                    البدء من جديد
                  </Button>
                )}
                <Button onClick={() => void send(true)} disabled={!file} loading={busy === "preview"}>
                  <Upload aria-hidden />
                  معاينة
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="danger" title="تعذّرت قراءة الملف">
                {error}
              </Alert>
            )}
            {done && (
              <Alert variant="success" title={`استُورد ${formatNumber(done.created)} منشوراً بحالة «${done.status === "draft" ? "مسودة" : "قيد المراجعة"}»`}>
                {done.invalid > 0 && <p>تُرك {formatNumber(done.invalid)} صفاً فيه أخطاء دون استيراد.</p>}
                <p className="mt-1">
                  راجع المواد ثم انشرها من{" "}
                  <Link className="font-bold underline" href={`/admin/posts?status=${done.status}`}>
                    قائمة المنشورات
                  </Link>
                  {done.status === "review" && (
                    <>
                      {" "}أو من{" "}
                      <Link className="font-bold underline" href="/admin/review">
                        المراجعة
                      </Link>
                    </>
                  )}
                  . الفهرسة للمساعد تتم عند النشر.
                </p>
              </Alert>
            )}
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader title="صيغة الملف" />
          <CardBody className="pt-2 text-sm leading-6 text-text-secondary">
            <p>
              <b className="text-text">إلزامي:</b> <code dir="ltr">category</code> ·{" "}
              <code dir="ltr">title_ar</code> · <code dir="ltr">content_ar</code>
            </p>
            <p className="mt-2">
              <b className="text-text">اختياري:</b>{" "}
              <code dir="ltr" className="break-words">
                id, section_slug, topic, title_en, content_en, summary_ar, tags, external_ref, source_name,
                content_type, file_url
              </code>
            </p>
            <ul className="mt-3 list-disc space-y-1 ps-5">
              <li>
                <code dir="ltr">category</code>: methodology · shubuhat · intro_islam · new_muslim
              </li>
              <li>
                <code dir="ltr">id</code> يصير الرابط المختصر (slug) إن كان بحروف إنجليزية.
              </li>
              <li>
                بلا <code dir="ltr">section_slug</code> تُوضع المادة في أول قسم رئيسي من المسار.
              </li>
              <li>
                الوسوم في CSV مفصولة بـ <code dir="ltr">|</code>
              </li>
              <li>النص يُحفظ حرفياً. النص العادي تُحفظ فقراته (المفصولة بسطر فارغ) كما هي.</li>
            </ul>
            <p className="mt-3 font-bold text-text">مثال معبأ بصف واحد:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "ghost", size: "sm" })} href="/templates/content-template.json" download>
                <Download aria-hidden />
                JSON
              </a>
              <a className={buttonVariants({ variant: "ghost", size: "sm" })} href="/templates/content-template.csv" download>
                <Download aria-hidden />
                CSV
              </a>
            </div>
          </CardBody>
        </Card>
      </div>

      {preview && (
        <section aria-labelledby="preview-title" className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="preview-title" className="text-lg font-bold text-text">
                2. المعاينة
              </h2>
              <p className="text-sm text-text-secondary" aria-live="polite">
                {formatNumber(preview.total)} صف · <span className="text-success-fg">{formatNumber(preview.valid)} صالح</span>
                {preview.invalid > 0 && (
                  <>
                    {" "}· <span className="text-danger-fg">{formatNumber(preview.invalid)} فيه أخطاء</span>
                  </>
                )}
              </p>
            </div>
            <Segmented<RowFilter>
              label="عرض الصفوف"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `الكل (${preview.total})` },
                { value: "valid", label: `الصالحة (${preview.valid})` },
                { value: "invalid", label: `فيها أخطاء (${preview.invalid})` },
              ]}
            />
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.index}
            caption="معاينة صفوف الاستيراد"
            empty={<EmptyState icon={<CheckCircle2 />} title="لا صفوف في هذا العرض" />}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-text-secondary">
              {preview.valid
                ? `سيُستورد ${formatNumber(preview.valid)} منشوراً بحالة «${statusLabel}»${preview.invalid ? `، ويُترك ${formatNumber(preview.invalid)} صفاً فيه أخطاء` : ""}.`
                : "لا يوجد صف صالح للاستيراد. صحّح الأخطاء في الملف ثم أعد المعاينة."}
            </p>
            <Button size="lg" disabled={!preview.valid} onClick={() => setConfirm(true)}>
              <Upload aria-hidden />
              استيراد {formatNumber(preview.valid)} منشوراً
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="تأكيد الاستيراد"
        description={`سيُنشأ ${formatNumber(preview?.valid ?? 0)} منشوراً بحالة «${statusLabel}». لن يُنشر أي منها حتى تراجعه وتنشره.`}
        confirmLabel="استيراد"
        variant="primary"
        loading={busy === "import"}
        onConfirm={() => void send(false)}
      />
    </>
  );
}
