import { BadgeCheck, FolderOpen, Inbox, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookIcon } from "@/components/brand";
import { PostCard } from "@/components/site/cards";
import { HeroAsk } from "@/components/site/hero-ask";
import { StarPattern, TRACK_ICON, TRUST_ICONS } from "@/components/site/icons";
import { SiteError } from "@/components/site/states";
import { EmptyState } from "@/components/ui/feedback";
import { fmtNumber } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { getSuggestedQuestions, tryGet } from "@/lib/public-api";
import { pick } from "@/lib/site";
import type { Category, PublicPostCard, PublicSection } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: `${t.meta.siteName} — ${t.meta.tagline}` },
    description: t.meta.description,
    openGraph: { title: t.meta.siteName, description: t.meta.description, url: "/" },
  };
}

/** رابط بطاقة المسار: الصفحة المخصصة للمسار، أو المكتبة مفلترة بالقسم. */
function trackHref(s: PublicSection): string {
  const map: Partial<Record<Category, string>> = {
    shubuhat: `/shubuhat?section=${s.slug}`,
    intro_islam: `/intro?section=${s.slug}`,
    new_muslim: "/new-muslim",
  };
  return map[s.category] ?? `/library?section=${s.slug}`;
}

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const [sections, latest, suggested] = await Promise.all([
    tryGet<PublicSection[]>("/api/sections"),
    tryGet<PublicPostCard[]>("/api/posts/latest", { limit: 6 }),
    getSuggestedQuestions(),
  ]);
  const tracks = (sections ?? []).filter((s) => s.parent_id === null);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-12 md:px-8 md:pb-[72px] md:pt-20">
        <StarPattern className="pointer-events-none absolute -end-[140px] -top-[120px] size-[560px] opacity-[0.04]" />
        <div className="relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-14">
          <div className="flex min-w-0 flex-[1_1_500px] flex-col gap-6">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-primary-100 px-3.5 py-1.5 text-sm font-bold text-primary-700">
              <ShieldCheck className="size-4" aria-hidden />
              {t.home.badge}
            </span>
            <h1 className="text-[40px] font-extrabold leading-[52px] text-primary-700 md:text-[56px] md:leading-[68px]">{t.home.title}</h1>
            <p className="max-w-[520px] text-lg leading-8 text-text-secondary md:text-[22px] md:leading-9">{t.home.subtitle}</p>
            <HeroAsk suggestions={suggested} />
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/library"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-[18px] text-[15px] font-bold text-text hover:border-approved-border hover:bg-primary-50"
              >
                {t.home.exploreLibrary}
              </Link>
              <span className="text-[13px] text-text-muted">{t.common.noFatwa}</span>
            </div>
          </div>

          {/* تكوين هادئ: سؤال ← فقاعة توجيه ← بطاقة نص معتمد (زخرفي) */}
          <div className="min-w-0 flex-[1_1_420px]" aria-hidden>
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-lg md:p-7">
              <div className="max-w-[85%] self-start rounded-lg bg-surface-muted px-4 py-3 text-[15px] leading-[26px]">{t.home.illoQuestion}</div>
              <div className="flex max-w-[90%] items-start gap-2.5 self-end">
                <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-primary-100 text-primary-600">
                  <BookIcon className="size-4" />
                </span>
                <div className="rounded-lg border border-border px-4 py-3 text-[15px] leading-[26px]">{t.home.illoGuidance}</div>
              </div>
              <div className="overflow-hidden rounded-lg border border-approved-border bg-primary-50">
                <div className="flex items-center justify-between gap-2 bg-primary-700 px-4 py-2.5 text-[13px] font-bold text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="size-[15px]" />
                    {t.home.illoApproved}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 p-4">
                  <div className="text-[17px] font-bold text-primary-700">{t.home.illoTitle}</div>
                  <div className="h-2.5 w-full rounded-[6px] bg-[#D9E8E4]" />
                  <div className="h-2.5 w-[94%] rounded-[6px] bg-[#D9E8E4]" />
                  <div className="h-2.5 w-[70%] rounded-[6px] bg-[#D9E8E4]" />
                  <div className="mt-1.5 flex justify-between gap-2 text-[13px] text-text-secondary">
                    <span>{t.home.illoSource}</span>
                    <span className="font-bold text-primary-600">{t.home.illoRead}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* شريط الثقة */}
      <section aria-label={t.home.trustLabel} className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 px-4 py-7 md:px-8">
          {t.home.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <div key={item.t} className="flex items-center gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-100 text-primary-600">
                  <Icon className="size-[22px]" aria-hidden />
                </span>
                <div>
                  <div className="text-base font-bold">{item.t}</div>
                  <div className="text-sm text-text-secondary">{item.d}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* كيف يعمل */}
      <section className="px-4 py-16 md:px-8 md:py-[88px]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex max-w-[640px] flex-col gap-2.5">
            <h2 className="text-h1-mobile md:text-h1">{t.home.howTitle}</h2>
            <p className="text-[17px] leading-[30px] text-text-secondary">{t.home.howDesc}</p>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {t.home.how.map((s, i) => (
              <li key={s.t} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6 shadow-sm">
                <span className="grid size-9 place-items-center rounded-full bg-primary-700 font-extrabold text-white">{fmtNumber(i + 1, locale)}</span>
                <h3 className="text-[19px] font-bold leading-7">{s.t}</h3>
                <p className="text-[15px] leading-[26px] text-text-secondary">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* استكشف المعرفة */}
      <section className="px-4 pb-16 md:px-8 md:pb-[88px]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              <h2 className="text-h1-mobile md:text-h1">{t.home.exploreTitle}</h2>
              <p className="text-[17px] leading-[30px] text-text-secondary">{t.home.exploreDesc}</p>
            </div>
            <Link href="/library" className="inline-flex min-h-11 items-center text-[15px] font-bold text-primary-600 hover:text-primary-700">
              {t.home.allSections}
            </Link>
          </div>
          {sections === null ? (
            <SiteError />
          ) : tracks.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState icon={<FolderOpen />} title={t.home.noSections} description={t.home.noSectionsHint} />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
              {tracks.map((s) => {
                const Icon = TRACK_ICON[s.category];
                const name = pick(s.name_ar, s.name_en, locale);
                return (
                  <Link
                    key={s.id}
                    href={trackHref(s)}
                    className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-7 shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
                  >
                    <span className="grid size-[52px] place-items-center rounded-[14px] bg-primary-100 text-primary-600">
                      <Icon className="size-[26px]" strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="text-xl font-bold" lang={name.lang}>
                      {name.text}
                    </span>
                    {s.description && (
                      <span className="text-[15px] leading-[26px] text-text-secondary" lang="ar">
                        {s.description}
                      </span>
                    )}
                    <span className="mt-auto flex items-center justify-between pt-2 text-sm">
                      <span className="text-text-muted">{t.common.materials(fmtNumber(s.posts_count, locale))}</span>
                      <span className="font-bold text-primary-600">{t.common.explore}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* أحدث المواد */}
      <section className="bg-surface-muted px-4 py-16 md:px-8 md:py-[88px]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <h2 className="text-h1-mobile md:text-h1">{t.home.latestTitle}</h2>
          {latest === null ? (
            <SiteError />
          ) : latest.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState icon={<Inbox />} title={t.home.noLatest} description={t.home.noLatestHint} />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
              {latest.map((p) => (
                <PostCard key={p.id} post={p} locale={locale} showTags={false} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
