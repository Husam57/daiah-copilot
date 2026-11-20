/**
 * عميل API موحد: يضيف JWT، ويحوّل الأخطاء إلى رسائل عربية، ويعيد التوجيه لصفحة الدخول عند 401.
 * لا يحتوي أي سر: العنوان من NEXT_PUBLIC_API_URL فقط.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const TOKEN_KEY = "daiah.token";
export const UNAUTHORIZED_EVENT = "daiah:unauthorized";

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  fields: FieldError[];

  constructor(status: number, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  /** رسالة خطأ حقل محدد (من أخطاء 422). */
  fieldMessage(field: string): string | undefined {
    return this.fields.find((f) => f.field === field || f.field.endsWith(`.${field}`))?.message;
  }
}

/** أسماء الحقول بالعربية (تظهر في رسائل 422 العامة). */
const FIELD_LABELS: Record<string, string> = {
  title_ar: "العنوان بالعربية",
  title_en: "العنوان بالإنجليزية",
  content_ar: "المحتوى بالعربية",
  content_en: "المحتوى بالإنجليزية",
  section_id: "القسم",
  slug: "الرابط المختصر",
  name_ar: "الاسم بالعربية",
  name_en: "الاسم بالإنجليزية",
  name: "الاسم",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  current_password: "كلمة المرور الحالية",
  new_password: "كلمة المرور الجديدة",
  category: "المسار",
  guidance_prompt: "تعليمات الأسلوب",
  similarity_threshold: "عتبة التشابه",
  top_k: "عدد النتائج",
  fallback_message_ar: "رسالة البدائل (ع)",
  fallback_message_en: "رسالة البدائل (En)",
  message: "السؤال",
  url: "الرابط",
  note: "الملاحظة",
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "الطلب غير صحيح",
  401: "انتهت الجلسة، سجّل الدخول من جديد",
  403: "ليست لديك صلاحية لهذه العملية",
  404: "العنصر المطلوب غير موجود",
  409: "تعارض مع بيانات موجودة",
  422: "البيانات المرسلة غير صحيحة",
  429: "طلبات كثيرة، انتظر قليلاً ثم حاول مرة أخرى",
  500: "حدث خطأ في الخادم، حاول مرة أخرى",
  502: "فشل الاتصال بخدمة خارجية (Gemini)، حاول مرة أخرى",
  503: "الخدمة غير متاحة مؤقتاً، حاول بعد قليل",
};

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* التخزين محظور: الجلسة تبقى في الذاكرة فقط */
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** false لطلبات لا تحتاج توكن (الدخول) ولا تعيد التوجيه عند 401 */
  auth?: boolean;
}

export function buildPath(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

/** 401: يحذف التوكن ويبلغ AuthProvider، فيحوّل تخطيط اللوحة إلى /admin/login?next=… */
function handleUnauthorized() {
  setToken(null);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown;
  let fields: FieldError[] = [];
  try {
    const data = await res.json();
    detail = data?.detail;
    if (Array.isArray(data?.errors)) fields = data.errors as FieldError[];
  } catch {
    /* ليس JSON */
  }
  let message = typeof detail === "string" && detail ? detail : STATUS_MESSAGES[res.status] ?? `خطأ غير متوقع (${res.status})`;
  if (res.status === 422 && fields.length) {
    const parts = fields.map((f) => `${FIELD_LABELS[f.field] ?? f.field}: ${f.message}`);
    message = `${message} — ${parts.join("، ")}`;
  }
  return new ApiError(res.status, message, fields);
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, auth = true } = opts;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${buildPath(path, query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "تعذّر الاتصال بالخادم. تأكد أن الـ Backend يعمل ثم أعد المحاولة.");
  }

  if (!res.ok) {
    const err = await toApiError(res);
    if (res.status === 401 && auth) handleUnauthorized();
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** رسالة عربية من أي خطأ (للـ Toast وحالات الخطأ). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "حدث خطأ غير متوقع";
}
