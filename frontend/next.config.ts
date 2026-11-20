import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
