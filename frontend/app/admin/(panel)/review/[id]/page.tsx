"use client";

import { ArrowRight, CheckCircle2, ExternalLink, FileDown, FileX, Pencil, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useShell } from "@/components/admin/shell-context";
import { Badge, StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { LanguageSwitch } from "@/components/ui/misc";
import { SafeHtml } from "@/components/ui/safe-html";
import { toast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CONTENT_TYPE_LABELS, formatRelative } from "@/lib/format";
import type { Post, PostWithIndex, Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReviewPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshCounts } = useShell();
  const post = useApi<Post>(/^\d+$/.test(id) ? `/api/admin/posts/${id}` : null);
  const sections = useApi<Section[]>("/api/admin/sections");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "return" | null>(null);
  const [lang, setLang] = useState<"ar" | "en">("ar");

  if (post.error instanceof ApiError && post.error.status === 404) {
    return (
      <Card>
        <EmptyState
          icon={<FileX />}
          title="المنشور غير موجود"
          action={
            <Link href="/admin/review" className={buttonVariants({ variant: "secondary" })}>
              العودة إلى المراجعة
            </Link>
          }
        />
      </Card>
    );
  }
  if (post.error) {
    return (
      <Card>
        <ErrorState message={post.error.message} onRetry={post.reload} />
      </Card>
    );
  }
  if (!post.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true">
        <Skeleton className="h-[560px] rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const p = post.data;
  const section = sections.data?.find((s) => s.id === p.section_id);
  const hasEn = !!p.content_en;
  const useEn = lang === "en" && hasEn;

  const approve = async () => {
    setBusy("approve");
    try {
      const res = await api<PostWithIndex>(`/api/admin/posts/${p.id}/publish`, { method: "POST" });
      if (res.index_warning) toast.warning(res.index_warning);
      else toast.success(`اعتُمد ونُشر «${p.title_ar}» (${res.chunks ?? 0} مقطع مفهرس)`);
      refreshCounts();
      router.push("/admin/review");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  const sendBack = async () => {
    if (!note.trim()) {
      setNoteError("اكتب ملاحظة توضّح ما المطلوب تعديله");
      return;
    }
    setBusy("return");
    try {
      const res = await api<PostWithIndex>(`/api/admin/posts/${p.id}/return-to-draft`, {
        method: "POST",
        body: { note: note.trim() },
      });
      if (res.note_saved === false) {
        toast.warning("أُرجع المنشور لمسودة، لكن لم تُحفظ الملاحظة: عمود review_note غير موجود (شغّل schema.sql).");
      } else {
        toast.success("أُرجع المنشور للتعديل مع ملاحظتك");
      }
      refreshCounts();
      router.push("/admin/review");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/review"
          className="grid size-10 place-items-center rounded-md text-text-secondary hover:bg-surface-muted"
          aria-label="العودة إلى المراجعة"
        >
          <ArrowRight className="size-5 ltr:-scale-x-100" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-muted">مراجعة منشور</p>
          <h1 className="truncate text-h3 text-text">{p.title_ar}</h1>
        </div>
        <StatusBadge status={p.status} />
      </div>

      {p.status !== "review" && (
        <Alert variant="info" className="mb-4">
          هذا المنشور ليس قيد المراجعة حالياً (الحالة: {p.status === "published" ? "منشور" : "مسودة"}).
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* عرض القراءة كما سيظهر في الموقع */}
        <Card className="min-w-0 p-6 md:p-10">
          {hasEn && (
            <div className="mb-6 flex justify-end">
              <LanguageSwitch value={lang} onChange={setLang} size="sm" />
            </div>
          )}
          <article lang={useEn ? "en" : "ar"} dir={useEn ? "ltr" : "rtl"} className="mx-auto max-w-prose">
            <div className="flex flex-wrap items-center gap-2">
              {section && <Badge variant="primary">{useEn ? section.name_en || section.name_ar : section.name_ar}</Badge>}
              <Badge variant="outline">{CONTENT_TYPE_LABELS[p.content_type]}</Badge>
              <VerifiedBadge />
            </div>
            <h2 className="mt-4 text-h1-mobile text-text md:text-h1">{useEn ? p.title_en || p.title_ar : p.title_ar}</h2>
            {!useEn && p.summary_ar && <p className="mt-3 text-body-lg text-text-secondary">{p.summary_ar}</p>}
            <hr className="my-6 border-border" />
            <SafeHtml html={useEn ? p.content_en : p.content_ar} className="text-body-lg" />
            {p.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 text-sm">
            <p className="mb-3 font-bold">المصدر</p>
            <p className="text-text">{p.source_name || <span className="text-danger">لم يُحدد المصدر</span>}</p>
            {p.external_ref ? (
              <a
                href={p.external_ref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1 text-primary-600 hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate" dir="ltr">
                  {p.external_ref}
                </span>
              </a>
            ) : (
              <p className="mt-1 text-text-muted">بلا رابط خارجي</p>
            )}
            {p.file_url && (
              <a
                href={p.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-primary-600 hover:underline"
              >
                <FileDown className="size-3.5" aria-hidden />
                الملف المرفق
              </a>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">أنشأه</dt>
                <dd>{p.created_by_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">آخر تعديل</dt>
                <dd>{formatRelative(p.updated_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">نسخة إنجليزية</dt>
                <dd>{hasEn ? "نعم" : "لا"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-4 p-5">
            <Field
              id="review-note"
              label="ملاحظات المراجع"
              hint="مطلوبة عند الإرجاع للتعديل، وتظهر للمحرر في صفحة المنشور."
              error={noteError}
            >
              <Textarea
                id="review-note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteError(null);
                }}
                rows={4}
              />
            </Field>
            <div className="grid gap-2">
              <Button onClick={approve} loading={busy === "approve"} disabled={!!busy || p.status === "published"}>
                {busy !== "approve" && <CheckCircle2 aria-hidden />}
                اعتماد ونشر
              </Button>
              <Button
                variant="secondary"
                onClick={sendBack}
                loading={busy === "return"}
                disabled={!!busy || p.status === "draft"}
              >
                {busy !== "return" && <Undo2 aria-hidden />}
                إرجاع للتعديل
              </Button>
              <Link href={`/admin/posts/${p.id}`} className={buttonVariants({ variant: "ghost" })}>
                <Pencil aria-hidden />
                فتح في المحرر
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
