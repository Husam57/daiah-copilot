"use client";

import { FileText, FolderTree, Inbox, MessageCircleQuestion, Percent, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { ApprovedTextCard, FallbackCard, GuidanceBubble, SourceChip } from "@/components/ui/answer";
import { Badge, IndexBadge, StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented, Slider, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Alert, CardSkeleton, EmptyState, ErrorState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LanguageSwitch, PageHeader, TagsInput } from "@/components/ui/misc";
import { StatCard, StatusDot, Stepper } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import type { PostStatus } from "@/lib/types";

const COLORS: { group: string; items: { token: string; hex: string; cls: string; dark?: boolean }[] }[] = [
  {
    group: "الأساسي",
    items: [
      { token: "primary-700", hex: "#0F4C47", cls: "bg-primary-700", dark: true },
      { token: "primary-600", hex: "#14645C", cls: "bg-primary-600", dark: true },
      { token: "primary-500", hex: "#1B7F74", cls: "bg-primary-500", dark: true },
      { token: "primary-100", hex: "#E3F1EE", cls: "bg-primary-100" },
      { token: "primary-50", hex: "#F2F8F6", cls: "bg-primary-50" },
      { token: "approved-border", hex: "#CFE3DE", cls: "bg-approved-border" },
    ],
  },
  {
    group: "التمييز",
    items: [
      { token: "accent-600", hex: "#9A7A45", cls: "bg-accent-600", dark: true },
      { token: "accent-100", hex: "#F5EDE0", cls: "bg-accent-100" },
      { token: "accent-fg", hex: "#7A5E30", cls: "bg-accent-fg", dark: true },
    ],
  },
  {
    group: "الخلفيات والحدود",
    items: [
      { token: "bg", hex: "#FAFAF7", cls: "bg-bg" },
      { token: "surface", hex: "#FFFFFF", cls: "bg-surface" },
      { token: "surface-muted", hex: "#F4F3EF", cls: "bg-surface-muted" },
      { token: "border", hex: "#E7E5DF", cls: "bg-border" },
    ],
  },
  {
    group: "النصوص",
    items: [
      { token: "text", hex: "#1C1F1E", cls: "bg-text", dark: true },
      { token: "text-secondary", hex: "#5B625F", cls: "bg-text-secondary", dark: true },
      { token: "text-muted", hex: "#8A918D", cls: "bg-text-muted", dark: true },
    ],
  },
  {
    group: "الحالات",
    items: [
      { token: "success", hex: "#1E7F4F", cls: "bg-success", dark: true },
      { token: "success-bg", hex: "#E6F4EC", cls: "bg-success-bg" },
      { token: "warning", hex: "#B7791F", cls: "bg-warning", dark: true },
      { token: "warning-bg", hex: "#FDF3E1", cls: "bg-warning-bg" },
      { token: "warning-fg", hex: "#8A5A12", cls: "bg-warning-fg", dark: true },
      { token: "danger", hex: "#B4362F", cls: "bg-danger", dark: true },
      { token: "danger-bg", hex: "#FBEAE8", cls: "bg-danger-bg" },
      { token: "info", hex: "#2563A6", cls: "bg-info", dark: true },
      { token: "info-bg", hex: "#E8F0FA", cls: "bg-info-bg" },
    ],
  },
];

const TYPE_SCALE = [
  { token: "display", spec: "40 / 52 · 800 (جوال 30)", cls: "text-display-mobile md:text-display" },
  { token: "h1", spec: "32 / 44 · 700 (جوال 26)", cls: "text-h1-mobile md:text-h1" },
  { token: "h2", spec: "24 / 34 · 700", cls: "text-h2" },
  { token: "h3", spec: "20 / 30 · 700", cls: "text-h3" },
  { token: "body-lg", spec: "18 / 34 · 400 — نص القراءة", cls: "text-body-lg" },
  { token: "body", spec: "16 / 28 · 400", cls: "text-body" },
  { token: "sm", spec: "14 / 24 · 500", cls: "text-sm" },
  { token: "xs", spec: "12 / 20 · 500", cls: "text-xs" },
];

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16, 24];
const RADII = [
  { token: "sm", px: 8, cls: "rounded-sm", use: "حقول، شارات" },
  { token: "md", px: 12, cls: "rounded-md", use: "أزرار، بطاقات صغيرة" },
  { token: "lg", px: 16, cls: "rounded-lg", use: "بطاقات" },
  { token: "xl", px: 24, cls: "rounded-xl", use: "Hero، نوافذ" },
];
const SHADOWS = [
  { token: "shadow-sm", cls: "shadow-sm", use: "البطاقات" },
  { token: "shadow-md", cls: "shadow-md", use: "Hover، القوائم" },
  { token: "shadow-lg", cls: "shadow-lg", use: "النوافذ فقط" },
];

// نص توضيحي محايد (ليس محتوى شرعياً) لعرض شكل البطاقات فقط
const SAMPLE_HTML =
  "<p>هذا <strong>نص توضيحي</strong> يبيّن شكل بطاقة النص المعتمد. في المنصة يُعرض هنا نص المنشور كما هو محفوظ في قاعدة البيانات حرفياً، دون أي تعديل من المساعد.</p><ul><li>عنصر أول في قائمة</li><li>عنصر ثانٍ في قائمة</li></ul><blockquote>اقتباس توضيحي قصير.</blockquote>";

interface DemoRow {
  id: number;
  title: string;
  section: string;
  status: PostStatus;
  updated: string;
}
const DEMO_ROWS: DemoRow[] = [
  { id: 1, title: "عنوان منشور توضيحي أول", section: "قسم تجريبي", status: "published", updated: "منذ ساعتين" },
  { id: 2, title: "عنوان منشور توضيحي ثانٍ", section: "قسم تجريبي", status: "review", updated: "أمس" },
  { id: 3, title: "عنوان منشور توضيحي ثالث", section: "قسم آخر", status: "draft", updated: "منذ 3 أيام" },
];
const DEMO_COLUMNS: Column<DemoRow>[] = [
  { key: "title", header: "العنوان", primary: true, cell: (r) => <span className="font-medium">{r.title}</span> },
  { key: "section", header: "القسم", cell: (r) => r.section },
  { key: "status", header: "الحالة", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "updated", header: "آخر تعديل", cell: (r) => <span className="text-text-muted">{r.updated}</span> },
  {
    key: "actions",
    header: <span className="sr-only">إجراءات</span>,
    actions: true,
    cell: () => (
      <Button variant="ghost" size="sm">
        تعديل
      </Button>
    ),
  },
];

export default function DesignSystemPage() {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [threshold, setThreshold] = useState([0.62]);
  const [on, setOn] = useState(true);
  const [tags, setTags] = useState(["وسم أول", "وسم ثانٍ"]);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Brand subtitle="نظام التصميم" />
          <LanguageSwitch value={lang} onChange={setLang} size="sm" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-14 px-4 py-8 md:px-8 md:py-12">
        <PageHeader
          title="نظام التصميم"
          description="الـ Tokens والمكونات المشتركة بين لوحة التحكم والموقع العام. المصدر: docs/design-brief.md"
        />

        {/* ===== الألوان ===== */}
        <Section title="الألوان" note="كل نص على خلفية يحقق تباين 4.5:1. أُضيف warning-fg و accent-fg لنصوص الشارات (اللونان الأصليان لا يحققان AA على خلفيتيهما).">
          <div className="space-y-6">
            {COLORS.map((g) => (
              <div key={g.group}>
                <h3 className="mb-3 text-sm font-bold text-text-secondary">{g.group}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {g.items.map((c) => (
                    <div key={c.token} className="overflow-hidden rounded-md border border-border bg-surface">
                      <div className={`${c.cls} h-16 border-b border-border`} />
                      <div className="px-3 py-2">
                        <p className="font-en text-xs font-bold text-text" dir="ltr">
                          {c.token}
                        </p>
                        <p className="font-en text-xs text-text-secondary" dir="ltr">
                          {c.hex}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ===== الخطوط ===== */}
        <Section title="الخطوط" note="العربية: Tajawal (400، 500، 700، 800) · الإنجليزية: Inter · عرض سطر القراءة max-w-prose.">
          <Card>
            <ul className="divide-y divide-border">
              {TYPE_SCALE.map((t) => (
                <li key={t.token} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                  <div className="w-44 shrink-0">
                    <p className="font-en text-xs font-bold text-primary-700" dir="ltr">
                      {t.token}
                    </p>
                    <p className="text-xs text-text-muted">{t.spec}</p>
                  </div>
                  <p className={t.cls}>معرفة موثقة، وتوجيه ذكي</p>
                </li>
              ))}
              <li className="px-5 py-4">
                <p className="font-en text-body" lang="en" dir="ltr">
                  Inter — Verified knowledge, smart guidance.
                </p>
              </li>
            </ul>
          </Card>
        </Section>

        {/* ===== المسافات والزوايا والظلال ===== */}
        <Section title="المسافات والأشكال" note="المسافات بأساس 4px · الحركة: 150ms للـ Hover و 200ms للانتقالات (ease-out) مع احترام prefers-reduced-motion.">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="المسافات" />
              <CardBody className="space-y-2">
                {SPACING.map((s) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-12 font-en text-xs text-text-muted" dir="ltr">
                      {s * 4}px
                    </span>
                    <span className="h-3 rounded-sm bg-primary-500" style={{ width: s * 4 }} />
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="الزوايا" />
              <CardBody className="grid grid-cols-2 gap-4">
                {RADII.map((r) => (
                  <div key={r.token} className="text-center">
                    <div className={`${r.cls} mx-auto size-16 border-2 border-primary-500 bg-primary-50`} />
                    <p className="mt-2 font-en text-xs font-bold" dir="ltr">
                      {r.token} · {r.px}px
                    </p>
                    <p className="text-xs text-text-muted">{r.use}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="الظلال" />
              <CardBody className="grid gap-4">
                {SHADOWS.map((s) => (
                  <div key={s.token} className={`${s.cls} rounded-md border border-border bg-surface px-4 py-3`}>
                    <p className="font-en text-xs font-bold" dir="ltr">
                      {s.token}
                    </p>
                    <p className="text-xs text-text-muted">{s.use}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* ===== الأزرار ===== */}
        <Section title="الأزرار" note="ارتفاع 40px (36 في الجداول) · حالة تحميل بمؤشر داخل الزر.">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Plus aria-hidden />
                  أساسي
                </Button>
                <Button variant="secondary">ثانوي</Button>
                <Button variant="ghost">شفاف</Button>
                <Button variant="danger">
                  <Trash2 aria-hidden />
                  حذف
                </Button>
                <Button variant="link">رابط</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">صغير (جدول)</Button>
                <Button size="lg">كبير</Button>
                <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>
                  {loading ? "جارٍ الحفظ…" : "اضغط للتحميل"}
                </Button>
                <Button disabled>معطّل</Button>
                <Button variant="secondary" size="icon" aria-label="إرسال">
                  <Send className="rtl:-scale-x-100" aria-hidden />
                </Button>
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* ===== الحقول ===== */}
        <Section title="الحقول" note="تسمية فوق الحقل، تلميح تحته، رسالة خطأ حمراء مع أيقونة، حلقة تركيز primary-500 بسماكة 2px.">
          <Card>
            <CardBody className="grid gap-5 md:grid-cols-2">
              <Field id="ds-title" label="العنوان" hint="يظهر في الموقع وفي بطاقة النص المعتمد." required>
                <Input id="ds-title" placeholder="اكتب العنوان…" />
              </Field>
              <Field id="ds-err" label="حقل به خطأ" error="هذا الحقل مطلوب">
                <Input id="ds-err" />
              </Field>
              <Field id="ds-select" label="القائمة">
                <Select id="ds-select" defaultValue="methodology">
                  <option value="methodology">المنهجية الدعوية</option>
                  <option value="shubuhat">الشبهات</option>
                </Select>
              </Field>
              <Field id="ds-tags" label="الوسوم (Chips)">
                <TagsInput id="ds-tags" value={tags} onChange={setTags} />
              </Field>
              <Field id="ds-text" label="نص طويل" className="md:col-span-2">
                <Textarea id="ds-text" placeholder="…" />
              </Field>
              <div className="space-y-3">
                <p className="text-sm font-medium">منزلق — عتبة التشابه: {threshold[0].toFixed(2)}</p>
                <Slider value={threshold} onValueChange={setThreshold} min={0.5} max={0.95} step={0.01} aria-label="عتبة التشابه" />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={on} onCheckedChange={setOn} aria-label="مفعّل" />
                  {on ? "مفعّل" : "موقوف"}
                </label>
                <Segmented
                  label="طريقة العرض"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "cards", label: "بطاقات" },
                    { value: "table", label: "جدول" },
                  ]}
                />
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* ===== الشارات والحالات ===== */}
        <Section title="الشارات والحالات" note="لا يُنقل أي معنى باللون وحده: كل شارة ونقطة معها نص.">
          <Card>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="draft" />
                <StatusBadge status="review" />
                <StatusBadge status="published" />
                <IndexBadge state="indexed" />
                <IndexBadge state="pending" />
                <IndexBadge state="stale" />
                <VerifiedBadge />
                <Badge variant="primary">المسار</Badge>
                <Badge variant="neutral">قريباً</Badge>
                <Badge variant="danger">مرفوض</Badge>
              </div>
              <div className="flex flex-wrap gap-6">
                <StatusDot state="ok" />
                <StatusDot state="warning" />
                <StatusDot state="down" />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Stepper status="draft" />
                <Stepper status="review" />
                <Stepper status="published" indexState="pending" />
                <Stepper status="published" indexState="indexed" />
              </div>
            </CardBody>
          </Card>
        </Section>

        {/* ===== البطاقات ===== */}
        <Section title="البطاقات والإحصاءات">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<FolderTree />} label="الأقسام" value="12" hint="10 مفعّلة" />
            <StatCard icon={<FileText />} label="المنشورات" value="148" change={{ value: "+6 هذا الأسبوع", positive: true }} />
            <StatCard icon={<Percent />} label="غير المجابة اليوم" value="8%" highlight />
            <StatCard icon={<MessageCircleQuestion />} label="أسئلة اليوم" value="—" loading />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card interactive className="p-5">
              <h3 className="text-h3">بطاقة تفاعلية</h3>
              <p className="mt-1 text-sm font-normal text-text-secondary">عند المرور: shadow-md ورفع 2px.</p>
            </Card>
            <CardSkeleton />
          </div>
        </Section>

        {/* ===== صوت المنصة مقابل صوت المساعد ===== */}
        <Section
          title="صوت المساعد مقابل صوت المنصة"
          note="القاعدة الذهبية بصرياً: فقاعة التوجيه = كلام المساعد. بطاقة النص المعتمد = نص موثق من المنصة حرفياً."
        >
          <div className="mx-auto max-w-3xl space-y-4" aria-live="polite">
            <GuidanceBubble text="جملة توجيه قصيرة من المساعد تدلّ السائل على المادة المناسبة أدناه." />
            <ApprovedTextCard
              title="عنوان مادة توضيحية"
              sectionName="اسم القسم"
              html={SAMPLE_HTML}
              sourceName="اسم المصدر"
              externalRef="https://example.com"
              readMoreHref="#"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <SourceChip index={1} title="مادة ذات صلة أولى" similarity={0.78} onClick={() => {}} />
              <SourceChip index={2} title="مادة ذات صلة ثانية" similarity={0.64} onClick={() => {}} />
            </div>
            <FallbackCard
              message="رسالة البدائل كما تُكتب في الإعدادات."
              closest={{ title: "أقرب مادة توضيحية", similarity: 0.48 }}
              referrals={[
                { id: 1, name: "مركز توضيحي", country: "الدولة", url: "https://example.com", contact: "info@example.com" },
                { id: 2, name: "مركز توضيحي آخر", country: "الدولة", url: null, contact: "+000 000 0000" },
              ]}
            />
          </div>
        </Section>

        {/* ===== الجدول ===== */}
        <Section title="DataTable" note="بلا حدود عمودية · رأس surface-muted · يتحول إلى بطاقات على الجوال.">
          <div className="mb-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setTableLoading(true); setTimeout(() => setTableLoading(false), 1500); }}>
              عرض حالة التحميل
            </Button>
          </div>
          <DataTable columns={DEMO_COLUMNS} rows={DEMO_ROWS} rowKey={(r) => r.id} loading={tableLoading} />
          <Pagination className="mt-4" page={page} pageSize={20} total={57} onPageChange={setPage} />
        </Section>

        {/* ===== الحالات الإلزامية ===== */}
        <Section title="الحالات: فارغة · خطأ · تنبيهات · تقدم">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <EmptyState
                icon={<Inbox />}
                title="لا توجد منشورات بعد"
                description="ابدأ بإضافة أول منشور."
                action={
                  <Button>
                    <Plus aria-hidden />
                    منشور جديد
                  </Button>
                }
              />
            </Card>
            <Card>
              <ErrorState message="تعذّر الاتصال بالخادم. تأكد أن الـ Backend يعمل ثم أعد المحاولة." onRetry={() => toast.info("إعادة المحاولة…")} />
            </Card>
          </div>
          <div className="mt-4 space-y-3">
            <Alert variant="info">المنشورات المنشورة فقط هي ما يستخدمه المساعد كمصدر.</Alert>
            <Alert variant="success" title="تم الحفظ">حُفظ المنشور وفُهرس.</Alert>
            <Alert variant="warning">تم الحفظ لكن فشلت الفهرسة.</Alert>
            <Alert variant="danger">البريد الإلكتروني أو كلمة المرور غير صحيحة.</Alert>
            <ProgressBar label="تقدم" value={64} />
            <ProgressBar label="جارٍ التنفيذ" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        </Section>

        {/* ===== النوافذ والتبويبات والإشعارات ===== */}
        <Section title="النوافذ والتبويبات والإشعارات">
          <Card>
            <CardBody className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => toast.success("تم الحفظ بنجاح")}>
                  Toast نجاح
                </Button>
                <Button variant="secondary" onClick={() => toast.error("فشلت العملية")}>
                  Toast خطأ
                </Button>
                <Button variant="secondary" onClick={() => toast.info("معلومة للمستخدم")}>
                  Toast معلومة
                </Button>
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  ConfirmDialog
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Sheet جانبي</Button>
                  </DialogTrigger>
                  <SheetContent
                    title="نموذج في Sheet"
                    description="يخرج من جهة النهاية."
                    footer={<Button>حفظ</Button>}
                  >
                    <Field id="ds-sheet" label="الاسم">
                      <Input id="ds-sheet" />
                    </Field>
                  </SheetContent>
                </Dialog>
              </div>
              <Tabs defaultValue="ar">
                <TabsList>
                  <TabsTrigger value="ar">العربية</TabsTrigger>
                  <TabsTrigger value="en">English</TabsTrigger>
                </TabsList>
                <TabsContent value="ar" className="pt-4 text-sm">
                  محتوى التبويب العربي.
                </TabsContent>
                <TabsContent value="en" className="pt-4 text-sm" lang="en" dir="ltr">
                  English tab content.
                </TabsContent>
              </Tabs>
            </CardBody>
          </Card>
        </Section>
      </main>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="حذف المنشور؟"
        itemName="عنوان منشور توضيحي"
        onConfirm={() => {
          setConfirm(false);
          toast.success("هذا عرض فقط — لم يُحذف شيء");
        }}
      />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`ds-${title}`}>
      <div className="mb-4 border-b border-border pb-3">
        <h2 id={`ds-${title}`} className="text-h2 text-text">
          {title}
        </h2>
        {note && <p className="mt-1 text-sm font-normal text-text-secondary">{note}</p>}
      </div>
      {children}
    </section>
  );
}
