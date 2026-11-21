import "server-only";
import { notFound } from "next/navigation";
import { API_URL } from "@/lib/env";

/**
 * جلب بيانات الموقع العام على الخادم (بدون JWT) من NEXT_PUBLIC_API_URL (lib/env.ts).
 * المسارات العامة لا ترجع إلا المنشور، والنص يُعرض كما هو بعد التنظيف بـ DOMPurify.
 */
const BASE = API_URL;

export class PublicApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

function url(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ""}`;
}

export async function publicGet<T>(path: string, query?: Query, opts?: { notFoundOn404?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(path, query), { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new PublicApiError(0, "network");
  }
  if (res.status === 404 && opts?.notFoundOn404) notFound();
  if (!res.ok) throw new PublicApiError(res.status, `HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** يرجع النتيجة أو null عند الخطأ (لعرض ErrorState بدل كسر الصفحة). */
export async function tryGet<T>(path: string, query?: Query): Promise<T | null> {
  try {
    return await publicGet<T>(path, query);
  } catch {
    return null;
  }
}

/** الأسئلة المقترحة من إعدادات اللوحة (GET /api/public/suggested-questions). أي خطأ = لا شيء يُعرض. */
export async function getSuggestedQuestions(): Promise<string[]> {
  const res = await tryGet<{ questions?: unknown }>("/api/public/suggested-questions");
  const qs = Array.isArray(res?.questions) ? res.questions : [];
  return qs.filter((q): q is string => typeof q === "string" && q.trim() !== "");
}
