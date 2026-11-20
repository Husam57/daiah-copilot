import type { ActivityType, Category, ContentType, IndexState, PostStatus } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  methodology: "المنهجية الدعوية",
  shubuhat: "الشبهات",
  intro_islam: "التعريف بالإسلام",
  new_muslim: "المسلم الجديد",
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "مسودة",
  review: "قيد المراجعة",
  published: "منشور",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "مقال",
  booklet: "كتيب",
  leaflet: "مطوية",
  shubha_response: "رد على شبهة",
};

export const INDEX_STATE_LABELS: Record<IndexState | "none", string> = {
  indexed: "مفهرس",
  stale: "يحتاج تحديث",
  pending: "بانتظار الفهرسة",
  none: "غير مفهرس",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  post_published: "نُشر منشور",
  index_updated: "حُدّث الفهرس",
  post_saved: "عُدّل منشور",
  post_review: "أُرسل للمراجعة",
  settings_updated: "عُدّلت التعليمات",
};

const dateFmt = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  numberingSystem: "latn",
});
const shortDateFmt = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "short",
  day: "numeric",
  numberingSystem: "latn",
});
const relFmt = new Intl.RelativeTimeFormat("ar", { numeric: "auto", style: "long" });
const numFmt = new Intl.NumberFormat("ar", { numberingSystem: "latn" });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : shortDateFmt.format(d);
}

/** "منذ 5 دقائق" */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "الآن";
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return relFmt.format(Math.round(diff / 86400), "day");
  return formatShortDate(iso);
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : numFmt.format(n);
}

export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatScore(s: number | null | undefined): string {
  return s === null || s === undefined ? "—" : s.toFixed(3);
}

/** حالة فهرسة منشور من بيانات القائمة (نفس منطق /ai/index-status: هامش 30 ث). */
export function postIndexState(p: {
  status: PostStatus;
  indexed_at: string | null;
  updated_at: string;
}): IndexState | "none" {
  if (p.status !== "published") return "none";
  if (!p.indexed_at) return "pending";
  const diff = new Date(p.updated_at).getTime() - new Date(p.indexed_at).getTime();
  return diff > 30_000 ? "stale" : "indexed";
}
