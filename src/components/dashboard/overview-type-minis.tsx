"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatEURWhole, formatEURCompact } from "@/lib/utils/formatters";
import { formatPercent } from "@/lib/utils/format-percent";
import { useDataTip } from "@/components/invoices/data-tip";
import { useChartLink } from "@/components/dashboard/use-chart-link";
import { expenseListHref } from "@/lib/invoices/expense-filters";
import {
  monthKeyToDate,
  roundPartsToTotal,
  sharedMonthlyMax,
  type ExpenseType,
  type TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";

// Same family as the Expense page's "Two purses" type bars (TYPE_BAR_COLOR
// in expense-purses-summary.tsx) — kept as CSS-var strings so it tracks theme.
const TYPE_COLOR: Record<ExpenseType, string> = {
  labor: "var(--accent)",
  materials_services: "var(--ink-2)",
  others: "var(--muted-2)",
};

const CHART_W = 212;
const CHART_H = 118;
const BAR_W = 24;
const BASELINE_Y = 100;
// Bars stop short of the top so the return markers below always have clear
// headroom above the tallest bar (and its trend dot) — see RETURN_MARKER_Y.
const PLOT_H = 80;

// Downward chevron marking a month a credit landed in, drawn above the column.
// Points down because the credit pulls that month's net spend down.
const RETURN_MARKER_Y = 5;
const RETURN_MARKER_HALF_W = 4;
const RETURN_MARKER_H = 5;

interface OverviewTypeMinisProps {
  buckets: TypeMonthlyBucket[];
  viewExpenseHref: string | null;
  /** The expenses could not be loaded: show "—", never zeros read as real. */
  unavailable?: boolean;
}

/** "Monthly spend by type" — a small multiple per expense type (bars + trend
 * line overlay, current month highlighted) on one shared scale (design Canvas
 * 3a, section 2b). */
export function OverviewTypeMinis({ buckets, viewExpenseHref, unavailable = false }: OverviewTypeMinisProps) {
  const t = useTranslations("dashboard");
  const tInvoices = useTranslations("invoices");
  const locale = useLocale();
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  // Same delegated hover tooltip the Expense summary uses on its month bars.
  const monthYearFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const { tipHandlers, overlay } = useDataTip();
  const chartLink = useChartLink();
  // Axis ticks sit 34 units apart: vi's short month ("Tháng 4") is too wide,
  // so each locale picks a compact tick ("T4" in vi).
  const monthTick = (key: string) => {
    const d = monthKeyToDate(key);
    return t("spendByType.monthTick", { m: d.getMonth() + 1, short: monthFmt.format(d) });
  };

  const sharedMax = sharedMonthlyMax(buckets);
  // Whole-euro type totals that add up to the whole-euro 6-month total.
  const shownTotals = roundPartsToTotal(buckets.map((b) => b.total));
  const sixMonthTotal = shownTotals.reduce((s, v) => s + v, 0);
  const first = buckets[0]?.monthly[0];
  const last = buckets[0]?.monthly[buckets[0].monthly.length - 1];

  return (
    <div
      className="folio-card flex flex-col p-6"
      data-testid="overview-type-minis"
      {...tipHandlers}
    >
      {/* Wraps the range and the link to their own lines on narrow screens
          rather than squeezing the title onto three lines ("Chi / phí →"). */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="font-display text-[18px] font-semibold tracking-tight">
            {t("spendByType.title")}
          </h2>
          {first && last && (
            <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {t("spendByType.rangeShared", {
                from: monthFmt.format(monthKeyToDate(first.key)),
                to: monthFmt.format(monthKeyToDate(last.key)),
              })}
              {" · "}
              {tInvoices("summary.netOfReturns")}
            </span>
          )}
        </div>
        {viewExpenseHref && (
          <Link
            href={viewExpenseHref}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium"
          >
            {t("spendByType.viewExpense")} <ArrowRight size={12} />
          </Link>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 content-center gap-6 sm:grid-cols-3">
        {buckets.map((bucket, bucketIdx) => {
          const lastIdx = bucket.monthly.length - 1;
          const heights = bucket.monthly.map((p) => Math.max((p.total / sharedMax) * PLOT_H, 2));
          const barX = (i: number) => 8 + i * 34;
          const midX = (i: number) => 20 + i * 34;
          const trendPoints = heights.map((h, i) => `${midX(i)},${(BASELINE_Y - h).toFixed(1)}`).join(" ");

          return (
            <div key={bucket.type}>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-[9px] w-[9px] flex-none rounded-[3px]"
                  style={{ background: TYPE_COLOR[bucket.type] }}
                />
                {viewExpenseHref ? (
                  <Link
                    href={expenseListHref(viewExpenseHref, { type: bucket.type })}
                    className="text-[12.5px] font-semibold hover:underline"
                    data-testid={`overview-type-link-${bucket.type}`}
                  >
                    {tInvoices(`types.${bucket.type}`)}
                  </Link>
                ) : (
                  <span className="text-[12.5px] font-semibold">{tInvoices(`types.${bucket.type}`)}</span>
                )}
              </div>
              <div className="num my-1.5 text-[18px] font-medium" style={{ letterSpacing: "-.02em" }}>
                {unavailable ? "—" : formatEURWhole(shownTotals[bucketIdx])}
              </div>
              <div className="mb-2 text-[11px]" style={{ color: "var(--muted)" }}>
                {unavailable ? "\u00a0" : tInvoices("invoiceCount", { n: bucket.count })}
                {/* Neutral, and named: less labor this month can be unpaid
                    work, not a saving. While the month runs, both months are
                    cut at today's day. */}
                {!unavailable && bucket.deltaPct !== null && lastIdx > 0 && (
                  <>
                    {" · "}
                    <span className="num" data-testid={`overview-type-delta-${bucket.type}`}>
                      {bucket.toDay
                        ? t("money.vsMonthToDate", {
                            delta: formatPercent(locale, bucket.deltaPct, true),
                            day: bucket.toDay,
                            month: monthFmt.format(monthKeyToDate(bucket.monthly[lastIdx - 1].key)),
                          })
                        : tInvoices("summary.vsMonth", {
                            delta: formatPercent(locale, bucket.deltaPct, true),
                            month: monthFmt.format(monthKeyToDate(bucket.monthly[lastIdx - 1].key)),
                          })}
                    </span>
                  </>
                )}
              </div>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                role="group"
                aria-label={tInvoices(`types.${bucket.type}`)}
                className="block h-auto w-full"
                style={{ maxWidth: CHART_W }}
              >
                <line x1={0} x2={CHART_W} y1={BASELINE_Y} y2={BASELINE_Y} stroke="var(--line)" strokeWidth={1} />
                {bucket.monthly.map((p, i) => (
                  <rect
                    key={p.key}
                    x={barX(i)}
                    y={(BASELINE_Y - heights[i]).toFixed(1)}
                    width={BAR_W}
                    height={heights[i].toFixed(1)}
                    rx={2}
                    fill={TYPE_COLOR[bucket.type]}
                    opacity={i === lastIdx ? 1 : 0.55}
                  />
                ))}
                {bucket.monthly.map((p, i) => (
                  <text key={`${p.key}-lbl`} x={midX(i)} y={114} textAnchor="middle" fontSize={10} fill="var(--muted)">
                    {monthTick(p.key)}
                  </text>
                ))}
                {/* The value of each month, readable without hovering. */}
                {!unavailable &&
                  bucket.monthly.map((p, i) =>
                    p.total !== 0 ? (
                      <text
                        key={`${p.key}-val`}
                        x={midX(i)}
                        y={Math.max(BASELINE_Y - heights[i] - 5, 20).toFixed(1)}
                        textAnchor="middle"
                        fontSize={8.5}
                        fill="var(--muted)"
                        aria-hidden="true"
                        data-testid={`overview-type-value-${bucket.type}-${p.key}`}
                      >
                        {formatEURCompact(locale, p.total)}
                      </text>
                    ) : null
                  )}
                <polyline
                  points={trendPoints}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.85}
                />
                {heights.map((h, i) => (
                  <circle key={`${bucket.monthly[i].key}-dot`} cx={midX(i)} cy={(BASELINE_Y - h).toFixed(1)} r={2.75} fill="var(--ink)" stroke="var(--card-paper)" strokeWidth={1.5} />
                ))}
                {/* Invisible per-month hit areas (painted last = on top) so the
                    target is the full column, not just the thin bar. Each opens
                    that type's expenses of that month. */}
                {bucket.monthly.map((p, i) => {
                  const tip = `${monthYearFmt.format(monthKeyToDate(p.key))}|${formatEURWhole(
                    p.total
                  )}|${tInvoices("invoiceCount", { n: p.count })}`;
                  return (
                    <rect
                      key={`${p.key}-hit`}
                      x={barX(i) - 5}
                      y={BASELINE_Y - PLOT_H - 6}
                      width={34}
                      height={PLOT_H + 24}
                      fill="transparent"
                      data-tip={tip}
                      data-testid={`overview-type-bar-${bucket.type}-${p.key}`}
                      {...chartLink(
                        viewExpenseHref ? expenseListHref(viewExpenseHref, { type: bucket.type, month: p.key }) : null,
                        `${tInvoices(`types.${bucket.type}`)} · ${tip.split("|").join(" · ")}`
                      )}
                    />
                  );
                })}
                {/* Return markers, painted after the column hit areas so the
                    marker's own (smaller) hit area wins the hover and shows
                    the credit rather than the month's net total. */}
                {bucket.monthly.map((p, i) =>
                  p.creditCount > 0 ? (
                    <g key={`${p.key}-credit`} data-testid={`return-marker-${bucket.type}-${p.key}`}>
                      <path
                        d={`M ${midX(i) - RETURN_MARKER_HALF_W},${RETURN_MARKER_Y} L ${
                          midX(i) + RETURN_MARKER_HALF_W
                        },${RETURN_MARKER_Y} L ${midX(i)},${RETURN_MARKER_Y + RETURN_MARKER_H} Z`}
                        fill="var(--negative)"
                      />
                      <rect
                        x={midX(i) - 9}
                        y={0}
                        width={18}
                        height={16}
                        fill="transparent"
                        data-tip={`${monthYearFmt.format(
                          monthKeyToDate(p.key)
                        )}|${formatEURWhole(p.credited)}|${tInvoices("summary.returnsReceived", {
                          n: p.creditCount,
                        })}`}
                      />
                    </g>
                  ) : null
                )}
              </svg>
              {/* Screen readers also get the months as a table. */}
              {!unavailable && (
                <table className="sr-only">
                  <caption>{tInvoices(`types.${bucket.type}`)}</caption>
                  <tbody>
                    {bucket.monthly.map((p) => (
                      <tr key={p.key}>
                        <th scope="row">{monthYearFmt.format(monthKeyToDate(p.key))}</th>
                        <td>{formatEURWhole(p.total)}</td>
                        <td>
                          {tInvoices("invoiceCount", { n: p.count })}
                          {p.creditCount > 0 &&
                            ` · ${tInvoices("summary.returnsReceived", { n: p.creditCount })} ${formatEURWhole(
                              p.credited
                            )}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div className="my-2.5" style={{ height: 1, background: "var(--paper-2)" }} />
      <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--muted)" }}>
        <span>{t("spendByType.currentHighlighted")}</span>
        <span>
          {t("spendByType.sixMonthSpend")}{" "}
          <span className="num font-semibold" style={{ color: "var(--ink)" }}>
            {unavailable ? "—" : formatEURWhole(sixMonthTotal)}
          </span>
        </span>
      </div>
      {overlay}
    </div>
  );
}
