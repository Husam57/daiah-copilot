/** جلب من الـ API العام في المتصفح (بلا JWT — لا يستخدم عميل اللوحة). */
import { API_URL } from "@/lib/api";

export class SiteApiError extends Error {
  constructor(
    public status: number,
    public retryAfter: number | null = null,
    public detail: string | null = null,
  ) {
    super(`HTTP ${status}`);
  }
}

export async function siteFetch<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: { Accept: "application/json", ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new SiteApiError(0);
  }
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const d = await res.json();
      detail = typeof d?.detail === "string" ? d.detail : null;
    } catch {
      /* ليس JSON */
    }
    const ra = Number(res.headers.get("retry-after"));
    throw new SiteApiError(res.status, Number.isFinite(ra) && ra > 0 ? ra : null, detail);
  }
  return (await res.json()) as T;
}

export function qs(query: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
