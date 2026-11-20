import { NextResponse, type NextRequest } from "next/server";

/**
 * يمرّر مسار الطلب للـ root layout (x-daiah-path) حتى يقرر lang/dir على <html>:
 * لوحة التحكم عربية دائماً، والموقع العام حسب كوكي daiah.lang.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-daiah-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
