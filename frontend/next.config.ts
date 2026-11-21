import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * بناء الإنتاج على Vercel يتطلب NEXT_PUBLIC_API_URL و NEXT_PUBLIC_SITE_URL بروابط https حقيقية،
 * حتى لا يُنشر موقع يتصل بـ localhost. البناء المحلي (للاختبار) يقبل قيم localhost الافتراضية.
 */
function checkProductionEnv() {
  const problems: string[] = [];
  for (const name of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
    const v = process.env[name]?.trim();
    if (!v) problems.push(`${name} غير مضبوط`);
    else if (!/^https:\/\//.test(v) || /localhost|127\.0\.0\.1/.test(v)) problems.push(`${name} يجب أن يكون رابط https عاماً (لا localhost)`);
  }
  if (problems.length) {
    throw new Error(`إعداد Vercel ناقص: ${problems.join("، ")}. أضفه في Settings → Environment Variables ثم أعد النشر.`);
  }
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL) checkProductionEnv();
  return {
    // لوحة التحكم تطبيق عميل (SPA) محمي بتوكن في localStorage ولا يجلب بيانات على الخادم،
    // فلا نستفيد من Cache Components، وحفظ الصفحات المخفية (Activity) قد يعرض نماذج وقوائم قديمة.
    cacheComponents: false,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
