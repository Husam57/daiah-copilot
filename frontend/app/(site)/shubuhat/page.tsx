import type { Metadata } from "next";
import { ShubuhatBrowser, type ShubhaCategory } from "@/components/site/shubuhat-browser";
import { getI18n } from "@/lib/i18n/server";
import { tryGet } from "@/lib/public-api";
import { pick } from "@/lib/site";
import type { PublicPostPage, PublicSection, PublicTopic } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.shubuhat,
    description: t.meta.shubuhatDesc,
    openGraph: { title: t.meta.shubuhat, description: t.meta.shubuhatDesc, url: "/shubuhat" },
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/**
 * التصنيفات تُقرأ من قاعدة البيانات: الأقسام الفرعية لمسار الشبهات إن وُجدت،
 * وإلا مواضيع (topic) المواد المنشورة فيه.
 */
export default async function ShubuhatPage({ searchParams }: PageProps<"/shubuhat">) {
  const sp = await searchParams;
  const { locale } = await getI18n();
  const [sections, topics] = await Promise.all([
    tryGet<PublicSection[]>("/api/sections", { category: "shubuhat" }),
    tryGet<PublicTopic[]>("/api/topics", { category: "shubuhat" }),
  ]);
  const all = sections ?? [];
  // الأقسام «الأوراق» (بلا أقسام فرعية) هي التصنيفات
  const leaves = all.filter((s) => !all.some((c) => c.parent_id === s.id));
  const categories: ShubhaCategory[] =
    leaves.length > 1
      ? leaves.map((s) => {
            const n = pick(s.name_ar, s.name_en, locale);
            return { key: s.slug, label: n.text, lang: n.lang, count: s.posts_count, param: "section" as const };
          })
      : (topics ?? []).map((tp) => ({ key: tp.topic, label: tp.topic, lang: "ar" as const, count: tp.posts_count, param: "topic" as const }));

  const q = one(sp.q);
  // ?section= من بطاقة المسار في الرئيسية يعني «كل الشبهات» إن لم يكن تصنيفاً فرعياً
  const catParam = one(sp.cat) || one(sp.section);
  const cat = categories.some((c) => c.key === catParam) ? catParam : "";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const active = categories.find((c) => c.key === cat);
  const initial = await tryGet<PublicPostPage>("/api/posts", {
    category: "shubuhat",
    q,
    [active?.param ?? "section"]: active?.key,
    page,
    page_size: 10,
  });

  return <ShubuhatBrowser initial={initial} categories={categories} initialQ={q} initialCat={cat} initialPage={page} />;
}
