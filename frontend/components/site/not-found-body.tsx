import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { StarPattern } from "@/components/site/icons";
import { getI18n } from "@/lib/i18n/server";

/** محتوى صفحة 404 (بلا Header/Footer). */
export async function NotFoundBody() {
  const { t } = await getI18n();
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-20">
      <StarPattern className="pointer-events-none absolute -bottom-40 -start-40 size-[520px] opacity-[0.04]" />
      <div className="relative flex max-w-lg flex-col items-center gap-4 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-primary-100 text-primary-700">
          <FileQuestion className="size-8" strokeWidth={1.8} aria-hidden />
        </span>
        <p className="font-en text-5xl font-extrabold text-primary-700" aria-hidden>
          404
        </p>
        <h1 className="text-h1-mobile md:text-h1">{t.notFound.title}</h1>
        <p className="text-[17px] leading-[30px] text-text-secondary">{t.notFound.desc}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-md bg-primary-700 px-5 font-bold text-white hover:bg-primary-600">
            {t.notFound.home}
          </Link>
          <Link href="/library" className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 font-bold hover:bg-primary-50">
            {t.notFound.library}
          </Link>
          <Link href="/assistant" className="inline-flex h-11 items-center rounded-md px-4 font-bold text-primary-600 hover:bg-primary-50">
            {t.nav.ask}
          </Link>
        </div>
      </div>
    </div>
  );
}
