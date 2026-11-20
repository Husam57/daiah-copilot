import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import { Providers } from "@/components/providers";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.meta.siteName, template: `%s · ${t.meta.siteName}` },
    description: t.meta.description,
    applicationName: t.meta.siteName,
    openGraph: {
      type: "website",
      siteName: t.meta.siteName,
      title: t.meta.siteName,
      description: t.meta.description,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      alternateLocale: locale === "ar" ? "en_US" : "ar_SA",
    },
    twitter: { card: "summary", title: t.meta.siteName, description: t.meta.description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} className={`${tajawal.variable} ${inter.variable} h-full`}>
      <body className="min-h-full">
        <Providers dir={dir}>{children}</Providers>
      </body>
    </html>
  );
}
