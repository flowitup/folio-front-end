"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatEURWhole } from "@/lib/utils/formatters";
import { useDataTip } from "@/components/invoices/data-tip";
import {
  monthKeyToDate,
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
}

/** "Monthly spend by type" — a small multiple per expense type (bars + trend
 * line overlay, current month highlighted) on one shared scale (design Canvas
 * 3a, section 2b). */
export function OverviewTypeMinis({ buckets, viewExpenseHref }: OverviewTypeMinisProps) {
  const t = useTranslations("dashboard");
  const tInvoices = useTranslations("invoices");
  const locale = useLocale();
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  // Same delegated hover tooltip the Expense summary uses on its month bars.
  const monthYearFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const { onMouseMove, onMouseLeave, overlay } = useDataTip();

  const sharedMax = sharedMonthlyMax(buckets);
  const sixMonthTotal = buckets.reduce((s, b) => s + b.total, 0);
  const first = buckets[0]?.monthly[0];
  const last = buckets[0]?.monthly[buckets[0].monthly.length - 1];

  return (
    <div
      className="folio-card flex flex-col p-6"
      data-testid="overview-type-minis"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
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
          <Link href={viewExpenseHref} className="flex items-center gap-1 text-[12.5px] font-medium">
            {t("spendByType.viewExpense")} <ArrowRight size={12} />
          </Link>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 content-center gap-6 sm:grid-cols-3">
        {buckets.map((bucket) => {
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
                <span className="text-[12.5px] font-semibold">{tInvoices(`types.${bucket.type}`)}</span>
              </div>
              <div className="num my-1.5 text-[18px] font-medium" style={{ letterSpacing: "-.02em" }}>
                {formatEURWhole(bucket.total)}
              </div>
              <div className="mb-2 text-[11px]" style={{ color: "var(--muted)" }}>
                {tInvoices("invoiceCount", { n: bucket.count })}
                {bucket.deltaPct !== null && (
                  <>
                    {" · "}
                    <span
                      className="num font-medium"
                      style={{ color: bucket.deltaPct > 0 ? "var(--negative)" : "var(--positive)" }}
                    >
                      {bucket.deltaPct > 0 ? "+" : ""}
                      {bucket.deltaPct}%
                    </span>
                  </>
                )}
              </div>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                aria-hidden="true"
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
                  <text key={`${p.key}-lbl`} x={midX(i)} y={114} textAnchor="middle" fontSize={10} fill="var(--muted-2)">
                    {monthFmt.format(monthKeyToDate(p.key))}
                  </text>
                ))}
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
                    hover target is the full column, not just the thin bar. */}
                {bucket.monthly.map((p, i) => (
                  <rect
                    key={`${p.key}-hit`}
                    x={barX(i) - 5}
                    y={BASELINE_Y - PLOT_H - 6}
                    width={34}
                    height={PLOT_H + 24}
                    fill="transparent"
                    data-tip={`${monthYearFmt.format(monthKeyToDate(p.key))}|${formatEURWhole(
                      p.total
                    )}|${tInvoices("invoiceCount", { n: p.count })}`}
                  />
                ))}
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
            {formatEURWhole(sixMonthTotal)}
          </span>
        </span>
      </div>
      {overlay}
    </div>
  );
}
