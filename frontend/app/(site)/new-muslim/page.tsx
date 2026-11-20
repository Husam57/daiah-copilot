import { Heart, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteError } from "@/components/site/states";
import { EmptyState } from "@/components/ui/feedback";
import { fmtNumber } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { tryGet } from "@/lib/public-api";
import { pick, postExcerpt, postHref, postTitle } from "@/lib/site";
import type { PublicPostPage, PublicSection, ReferralCenter } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.newMuslim,
    description: t.meta.newMuslimDesc,
    openGraph: { title: t.meta.newMuslim, description: t.meta.newMuslimDesc, url: "/new-muslim" },
  };
}

interface Step {
  key: string;
  href: string;
  title: { text: string; lang: "ar" | "en" };
  desc: { text: string; lang: "ar" | "en" } | null;
  count: number | null;
}

/**
 * حقيبة المسلم الجديد (NewMuslim.dc.html). الخطوات تُقرأ من قاعدة البيانات:
 * الأقسام الفرعية لمسار المسلم الجديد بترتيبها، وإن لم توجد فالمواد المنشورة في المسار.
 * لا نصوص دينية مكتوبة في الواجهة.
 */
export default async function NewMuslimPage() {
  const { t, locale } = await getI18n();
  const [sections, centers] = await Promise.all([
    tryGet<PublicSection[]>("/api/sections", { category: "new_muslim" }),
    tryGet<ReferralCenter[]>("/api/referral-centers"),
  ]);
  let steps: Step[] = [];
  let failed = sections === null;
  const subs = (sections ?? []).filter((s) => s.parent_id !== null).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  if (subs.length > 0) {
    steps = subs.map((s) => ({
      key: `s${s.id}`,
      href: `/library?section=${s.slug}`,
      title: pick(s.name_ar, s.name_en, locale),
      desc: s.description ? { text: s.description, lang: "ar" } : null,
      count: s.posts_count,
    }));
  } else if (sections) {
    const posts = await tryGet<PublicPostPage>("/api/posts", { category: "new_muslim", page_size: 12 });
    failed = posts === null;
    steps = (posts?.items ?? [])
      .slice()
      .reverse() // الأقدم أولاً كمسار تعلّم
      .map((p) => {
        const ex = postExcerpt(p, locale);
        return { key: `p${p.id}`, href: postHref(p.slug), title: postTitle(p, locale), desc: ex.text ? ex : null, count: null };
      });
  }

  return (
    <>
      <section className="px-4 pb-12 pt-14 md:px-8 md:pt-[72px]">
        <div className="mx-auto flex max-w-[760px] flex-col items-center gap-[18px] text-center">
          <span className="grid size-16 place-items-center rounded-[20px] bg-primary-100 text-primary-700">
            <Heart className="size-8" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 className="text-[32px] font-extrabold leading-[44px] text-primary-700 md:text-[42px] md:leading-[56px]">{t.newMuslim.title}</h1>
          <p className="text-lg leading-8 text-text-secondary md:text-xl md:leading-9">{t.newMuslim.desc}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-4 pb-24 md:px-8">
        {failed ? (
          <SiteError />
        ) : steps.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState icon={<Inbox />} title={t.newMuslim.empty} description={t.newMuslim.emptyHint} />
          </div>
        ) : (
          <ol aria-label={t.newMuslim.steps} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
            {steps.map((s, i) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className="flex h-full items-start gap-[18px] rounded-[20px] border border-border bg-surface p-7 shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-700 text-xl font-extrabold text-white" aria-hidden>
                    {fmtNumber(i + 1, locale)}
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="text-[21px] font-bold leading-8" lang={s.title.lang}>
                      <span className="sr-only">{fmtNumber(i + 1, locale)}. </span>
                      {s.title.text}
                    </span>
                    {s.desc && (
                      <span className="text-base leading-7 text-text-secondary" lang={s.desc.lang}>
                        {s.desc.text}
                      </span>
                    )}
                    {s.count !== null && <span className="text-sm text-text-muted">{t.newMuslim.count(fmtNumber(s.count, locale))}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-approved-border bg-primary-50 p-7">
          <div className="flex max-w-[560px] flex-col gap-1.5">
            <span className="text-xl font-bold text-primary-700">{t.newMuslim.helpTitle}</span>
            <span className="text-base leading-7 text-text-secondary">{t.newMuslim.helpDesc}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/assistant" className="inline-flex h-12 items-center rounded-md bg-primary-700 px-[22px] text-base font-bold text-white hover:bg-primary-600">
              {t.newMuslim.askCta}
            </Link>
            <a
              href="#centers"
              className="inline-flex h-12 items-center rounded-md border border-approved-border bg-surface px-[22px] text-base font-bold text-primary-700 hover:bg-primary-100"
            >
              {t.newMuslim.centersCta}
            </a>
          </div>
        </div>

        <section id="centers" aria-labelledby="centers-title" className="flex scroll-mt-24 flex-col gap-4">
          <h2 id="centers-title" className="text-h2">
            {t.newMuslim.centersTitle}
          </h2>
          {centers === null ? (
            <SiteError />
          ) : centers.length === 0 ? (
            <p className="text-base text-text-muted">{t.newMuslim.noCenters}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
              {centers.map((c) => (
                <li key={c.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-5">
                  <span className="text-lg font-bold" dir="auto">
                    {c.name}
                  </span>
                  {c.country && <span className="text-sm text-text-muted">{c.country}</span>}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-600 hover:underline">
                      {t.assistant.visitSite}
                    </a>
                  )}
                  {c.contact && (
                    <span className="truncate text-sm text-text-secondary" dir="auto">
                      {c.contact}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
