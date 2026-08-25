"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { formatEURWhole } from "@/lib/utils/formatters";
import { useDataTip } from "@/components/invoices/data-tip";
import {
  computeBankReleaseMetrics,
  buildReleaseSeries,
  type ReleasePoint,
} from "@/lib/dashboard/bank-release-metrics";
import type { Invoice } from "@/types/invoice";

/**
 * "Remaining to release from the bank" card, shared by the Overview dashboard
 * and the Expense ledger so both read the same figure.
 *
 * Headline is `credit − released`: what the bank still holds of the crédit
 * immobilier recorded in project settings. Below it, a draw-down track splits
 * the credit into released (accent) vs still-at-the-bank (track), and a
 * month-by-month timeline plots the CUMULATIVE amount released as a share of
 * the credit — so the bars climb toward the dashed credit ceiling and the gap
 * above the last bar is exactly the headline figure.
 *
 * Figure sourcing: `releasedTotal` comes from the backend invoices meta
 * (`funds_released_total`, authoritative); the monthly split is derived
 * client-side from the same project's `released_funds` rows, so the last
 * bar's cumulative can differ marginally from the meta only if a release row
 * is missing from the fetched list.
 */
interface BankReleaseChartProps {
  /** Project credit total (crédit immobilier). Null/0 → prompt to set it. */
  credit: number | null | undefined;
  /** Backend meta `funds_released_total` — money already drawn. */
  releasedTotal: number;
  /** Unfiltered project invoice list; only `released_funds` rows are read. */
  invoices: Invoice[];
  /** Funding source label (e.g. "Prêt bancaire BNP"), shown as a stamp. */
  source?: string | null;
  /** Link to project settings for the empty state. Null hides the link. */
  settingsHref?: string | null;
  /** True while the invoices fetch hasn't settled — figures aren't real yet. */
  loading?: boolean;
}

const PLACEHOLDER = "—";
// Floor keeps a zero/near-zero cumulative month visible on the timeline.
const MIN_BAR_PCT = 3;

export function BankReleaseChart({
  credit,
  releasedTotal,
  invoices,
  source,
  settingsHref,
  loading = false,
}: BankReleaseChartProps) {
  const t = useTranslations("projects.bankRelease");
  const locale = useLocale();
  const { onMouseMove, onMouseLeave, overlay } = useDataTip();

  const metrics = computeBankReleaseMetrics(credit, releasedTotal);
  const series = buildReleaseSeries(invoices);
  const monthYear = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const monthOnly = new Intl.DateTimeFormat(locale, { month: "short" });
  const fig = (value: string) => (loading ? PLACEHOLDER : value);

  // Bar denominator: the credit ceiling once known, else the final cumulative
  // (so the timeline still has a readable shape before a credit is recorded).
  const ceiling = metrics.hasCredit
    ? metrics.credit
    : Math.max(series[series.length - 1]?.cumulative ?? 0, 1);
  const barPct = (point: ReleasePoint) =>
    Math.max(Math.min((point.cumulative / ceiling) * 100, 100), MIN_BAR_PCT);

  const overDrawn = metrics.remaining < 0;

  return (
    <div
      className="folio-card flex flex-col gap-4 p-5"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-testid="bank-release-chart"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark size={16} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <span className="text-[12.5px] font-semibold">{t("title")}</span>
        </div>
        {source ? <span className="stamp">{source}</span> : null}
      </div>

      {metrics.hasCredit ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <div className="label-cap" style={{ color: "var(--muted)" }}>
                {overDrawn ? t("overDrawn") : t("remainingToRelease")}
              </div>
              <div
                className="num mt-1.5 text-[30px] font-medium leading-none"
                style={{
                  letterSpacing: "-.02em",
                  color: overDrawn && !loading ? "var(--negative)" : undefined,
                }}
                data-testid="bank-release-remaining"
              >
                {fig(formatEURWhole(Math.abs(metrics.remaining)))}
              </div>
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {t("releasedOf", {
                released: fig(formatEURWhole(metrics.released)),
                credit: fig(formatEURWhole(metrics.credit)),
              })}
            </div>
          </div>

          {/* Draw-down track: released vs still at the bank */}
          <div>
            <span
              className="block h-[10px] overflow-hidden rounded-full"
              style={{ background: "var(--paper-2)" }}
            >
              <span
                className="block h-full rounded-full"
                data-tip={`${t("released")}|${formatEURWhole(metrics.released)}|${t("pctReleased", {
                  pct: metrics.pct,
                })}`}
                style={{
                  width: loading ? "0%" : `${metrics.pctClamped}%`,
                  background: overDrawn ? "var(--negative)" : "var(--accent)",
                }}
              />
            </span>
            <div
              className="mt-1.5 flex justify-between text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              <span>{formatEURWhole(0)}</span>
              <span className="num">{loading ? PLACEHOLDER : t("pctReleased", { pct: metrics.pct })}</span>
              <span className="num">{fig(formatEURWhole(metrics.credit))}</span>
            </div>
          </div>
        </>
      ) : (
        <div
          className="rounded-lg border border-dashed px-4 py-3 text-[11.5px]"
          style={{ borderColor: "var(--line-2)", color: "var(--muted)" }}
          data-testid="bank-release-no-credit"
        >
          <div className="font-medium" style={{ color: "var(--ink-2)" }}>
            {t("noCredit")}
          </div>
          <p className="mt-1">{t("noCreditHint")}</p>
          {settingsHref ? (
            <Link
              href={settingsHref}
              className="mt-1.5 inline-block underline"
              style={{ color: "var(--accent)" }}
            >
              {t("openSettings")}
            </Link>
          ) : null}
        </div>
      )}

      {/* Cumulative draw-down timeline */}
      {!loading && series.length > 0 ? (
        <div>
          <div
            className="flex h-[52px] items-end gap-[3px]"
            style={{
              borderTop: metrics.hasCredit ? "1px dashed var(--line-2)" : undefined,
            }}
            data-testid="bank-release-bars"
          >
            {series.map((point, i) => (
              <span
                key={point.key}
                className="flex-1 rounded-[2px]"
                data-tip={`${monthYear.format(monthDate(point.key))}|${formatEURWhole(
                  point.cumulative
                )}|${t("releasedInMonth", { amount: formatEURWhole(point.amount) })}`}
                style={{
                  height: `${barPct(point)}%`,
                  background:
                    i === series.length - 1
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--accent) 34%, var(--paper-2))",
                }}
              />
            ))}
          </div>
          <div
            className="mt-1.5 flex justify-between text-[10.5px]"
            style={{ color: "var(--muted)" }}
          >
            <span>{monthOnly.format(monthDate(series[0].key))}</span>
            <span>{t("cumulativeReleased")}</span>
            <span>{monthOnly.format(monthDate(series[series.length - 1].key))}</span>
          </div>
        </div>
      ) : !loading ? (
        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          {t("noReleases")}
        </div>
      ) : null}

      {overlay}
    </div>
  );
}

/** First day of the month for a "YYYY-MM" key — numeric args avoid the
 * UTC-midnight day-shift of parsing date-only strings. */
function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}
