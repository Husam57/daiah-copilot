import "server-only";
import { notFound } from "next/navigation";

/**
 * جلب بيانات الموقع العام على الخادم (بدون JWT). API_URL (خاص بالخادم) ثم NEXT_PUBLIC_API_URL.
 * المسارات العامة لا ترجع إلا المنشور، والنص يُعرض كما هو بعد التنظيف بـ DOMPurify.
 */
const BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

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
