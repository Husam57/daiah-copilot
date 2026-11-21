"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatNumber, formatPercent } from "@/lib/format";
import type { DailyQuestions } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const PLOT_H = 168; // ارتفاع منطقة الرسم بالبكسل
const weekdayFmt = new Intl.DateTimeFormat("ar", { weekday: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** أعلى قيمة «نظيفة» للمحور بنصف صحيح (القيمة الوسطى رقم صحيح أيضاً)، وأدناها 4. */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const half = v / 2;
  const p = 10 ** Math.floor(Math.log10(half));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const step = m * p;
    if (step >= half && Number.isInteger(step)) return 2 * step;
  }
  return 20 * p;
}

type View = "chart" | "table";

/**
 * عدد الأسئلة يومياً (مُجابة + غير مجابة مكدّستين على محور عدد واحد) خلال آخر 7 أيام،
 * ونسبة غير المجابة للفترة رقماً بارزاً (لا محور ثانٍ). Hover/Focus على كل يوم يعرض التفاصيل، وعرض جدول بديل.
 */
export function QuestionsChart({ className }: { className?: string }) {
  // فرق التوقيت المحلي عن UTC بالدقائق (الأيام بتوقيت المستخدم)
  const [tz] = useState(() => -new Date().getTimezoneOffset());
  const res = useApi<DailyQuestions>("/api/admin/dashboard/questions-daily", { days: 7, tz_offset: tz });
  const [view, setView] = useState<View>("chart");
  const [active, setActive] = useState<number | null>(null);
  const d = res.data;
  const max = useMemo(() => niceMax(Math.max(0, ...(d?.items.map((i) => i.questions) ?? [0]))), [d]);
  const ticks = [max, max / 2, 0];
  const lastIdx = (d?.items.length ?? 0) - 1;

  return (
    <Card className={cn("flex min-w-0 flex-col gap-4 p-[22px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold leading-7">الأسئلة خلال آخر ٧ أيام</h2>
          <p className="text-sm text-text-secondary">عدد أسئلة المساعد يومياً، وكم منها لم تتوفر له مادة معتمدة.</p>
        </div>
        <Segmented<View>
          label="طريقة العرض"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "رسم", icon: <BarChart3 aria-hidden /> },
            { value: "table", label: "جدول", icon: <Table2 aria-hidden /> },
          ]}
        />
      </div>

      {res.loading ? (
        <Skeleton className="h-[260px] w-full rounded-md" />
      ) : res.error || !d ? (
        <ErrorState compact message={res.error?.message ?? "تعذّر تحميل البيانات"} onRetry={res.reload} />
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs font-medium text-text-muted">إجمالي الأسئلة</dt>
              <dd className="text-2xl font-bold leading-9 text-text">{formatNumber(d.total)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted">نسبة غير المجابة</dt>
              <dd className="text-2xl font-bold leading-9 text-text">
                {formatPercent(d.fallback_rate)}
                <span className="ms-2 text-sm font-medium text-text-secondary">
                  ({formatNumber(d.fallback)} سؤالاً)
                </span>
              </dd>
            </div>
          </dl>

          {view === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">الأسئلة يومياً خلال آخر ٧ أيام</caption>
                <thead className="bg-surface-muted text-start text-text-secondary">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start font-bold">اليوم</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">الأسئلة</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">مُجابة</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">غير مجابة</th>
                    <th scope="col" className="px-3 py-2 text-start font-bold">نسبة غير المجابة</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((i) => (
                    <tr key={i.date} className="border-b border-border-subtle last:border-0">
                      <th scope="row" className="px-3 py-2 text-start font-medium">
                        {longFmt.format(new Date(i.date))}
                      </th>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(i.questions)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(i.answered)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(i.fallback)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatPercent(i.fallback_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <ul className="mb-3 flex flex-wrap gap-4 text-xs font-medium text-text-secondary" aria-label="مفتاح الرسم">
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-chart-answered" aria-hidden />
                  مُجابة بمادة معتمدة
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-chart-unanswered" aria-hidden />
                  غير مجابة
                </li>
              </ul>

              <div className="flex gap-2">
                {/* محور القيم */}
                <div className="relative w-7 shrink-0 text-xs tabular-nums text-text-muted" style={{ height: PLOT_H }} aria-hidden>
                  {ticks.map((t, k) => (
                    <span key={t} className="absolute end-0 -translate-y-1/2 leading-none" style={{ top: (k * PLOT_H) / 2 }}>
                      {formatNumber(t)}
                    </span>
                  ))}
                </div>

                <div className="relative min-w-0 flex-1">
                  {/* خطوط الشبكة (hairline) */}
                  <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_H }} aria-hidden>
                    {ticks.map((t, k) => (
                      <div
                        key={t}
                        className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-border-strong" : "bg-border-subtle")}
                        style={{ top: (k * PLOT_H) / 2 }}
                      />
                    ))}
                  </div>

                  <ol className="relative flex items-stretch" aria-label="الأسئلة يومياً">
                    {d.items.map((i, idx) => {
                      const hA = (i.answered / max) * PLOT_H;
                      const hF = (i.fallback / max) * PLOT_H;
                      const isToday = idx === lastIdx;
                      const label = `${longFmt.format(new Date(i.date))}: ${formatNumber(i.questions)} سؤالاً، ${formatNumber(
                        i.answered,
                      )} مُجابة و${formatNumber(i.fallback)} غير مجابة (${formatPercent(i.fallback_rate)})`;
                      return (
                        <li key={i.date} className="flex min-w-0 flex-1 flex-col items-center">
                          <button
                            type="button"
                            aria-label={label}
                            onMouseEnter={() => setActive(idx)}
                            onMouseLeave={() => setActive((a) => (a === idx ? null : a))}
                            onFocus={() => setActive(idx)}
                            onBlur={() => setActive((a) => (a === idx ? null : a))}
                            className={cn(
                              "relative flex w-full flex-col items-center justify-end rounded-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary-500",
                              active === idx && "bg-primary-50/70",
                            )}
                            style={{ height: PLOT_H }}
                          >
                            {/* قيمة اليوم الأخير فقط (تسمية انتقائية) */}
                            {isToday && i.questions > 0 && (
                              <span className="mb-1 text-xs font-bold tabular-nums text-text" aria-hidden>
                                {formatNumber(i.questions)}
                              </span>
                            )}
                            <span className="flex w-full max-w-6 flex-col items-stretch gap-[2px]" aria-hidden>
                              {i.fallback > 0 && (
                                <span
                                  className={cn("block bg-chart-unanswered", "rounded-t-[4px]")}
                                  style={{ height: Math.max(2, hF) }}
                                />
                              )}
                              {i.answered > 0 && (
                                <span
                                  className={cn("block bg-chart-answered", i.fallback === 0 && "rounded-t-[4px]")}
                                  style={{ height: Math.max(2, hA) }}
                                />
                              )}
                            </span>

                            {active === idx && (
                              <span
                                role="tooltip"
                                className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[220px] rounded-md border border-border bg-surface px-3 py-2 text-start text-xs shadow-md"
                              >
                                <span className="block font-bold text-text">{longFmt.format(new Date(i.date))}</span>
                                <span className="mt-1 flex items-center gap-1.5 text-text-secondary">
                                  <span className="size-2 rounded-[2px] bg-chart-answered" />
                                  مُجابة: <b className="text-text">{formatNumber(i.answered)}</b>
                                </span>
                                <span className="flex items-center gap-1.5 text-text-secondary">
                                  <span className="size-2 rounded-[2px] bg-chart-unanswered" />
                                  غير مجابة: <b className="text-text">{formatNumber(i.fallback)}</b>
                                </span>
                                <span className="mt-1 block border-t border-border-subtle pt-1 text-text-secondary">
                                  الإجمالي {formatNumber(i.questions)} · غير المجابة {formatPercent(i.fallback_rate)}
                                </span>
                              </span>
                            )}
                          </button>
                          <span className={cn("mt-2 text-center text-xs leading-4", isToday ? "font-bold text-text" : "text-text-muted")} aria-hidden>
                            <span className={cn(!isToday && "hidden sm:block")}>{isToday ? "اليوم" : weekdayFmt.format(new Date(i.date))}</span>
                            <span className={cn("block text-[11px] font-normal text-text-muted", isToday && "hidden sm:block")}>
                              {dayFmt.format(new Date(i.date))}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
              {d.total === 0 && (
                <p className="mt-3 text-center text-sm text-text-secondary">لم يُطرح أي سؤال على المساعد خلال آخر ٧ أيام.</p>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
