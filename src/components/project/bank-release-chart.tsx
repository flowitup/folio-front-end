"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatEURWhole } from "@/lib/utils/formatters";
import { useDataTip } from "@/components/invoices/data-tip";
import {
  computeBankReleaseMetrics,
  buildDrawSeries,
} from "@/lib/dashboard/bank-release-metrics";
import type { Invoice } from "@/types/invoice";

/**
 * "Draw ledger" card (design 2b), shared by the Overview dashboard and the
 * Expense ledger so both read the same figure.
 *
 * Headline is `credit − released`: what the bank still holds of the crédit
 * immobilier recorded in project settings. Below it, a segmented pill track
 * slices the credit into one segment per draw with a hatched tail for what is
 * left — hovering a segment reveals that draw's number, date and amount — and
 * a stats footer carries the largest and last draw.
 *
 * Figure sourcing: `releasedTotal` comes from the backend invoices meta
 * (`funds_released_total`, authoritative); the per-draw split is derived
 * client-side from the same project's `released_funds` rows, so the track can
 * differ marginally from the meta only if a release row is missing from the
 * fetched list.
 */
interface BankReleaseChartProps {
  /** Project credit total (crédit immobilier). Null/0 → prompt to set it. */
  credit: number | null | undefined;
  /** Backend meta `funds_released_total` — money already drawn. */
  releasedTotal: number;
  /** Unfiltered project invoice list; only `released_funds` rows are read. */
  invoices: Invoice[];
  /** Link to project settings for the empty state. Null hides the link. */
  settingsHref?: string | null;
  /** True while the invoices fetch hasn't settled — figures aren't real yet. */
  loading?: boolean;
}

const PLACEHOLDER = "—";
// Warm dark pair for alternating track segments (design literal, no token).
const SEGMENT_ALT = "#5a5348";
const TRACK_HATCH =
  "repeating-linear-gradient(-45deg, rgba(232,132,60,.18) 0 3px, rgba(251,231,212,.6) 3px 7px)";

export function BankReleaseChart({
  credit,
  releasedTotal,
  invoices,
  settingsHref,
  loading = false,
}: BankReleaseChartProps) {
  const t = useTranslations("projects.bankRelease");
  const locale = useLocale();
  const { onMouseMove, onMouseLeave, overlay } = useDataTip();

  const metrics = computeBankReleaseMetrics(credit, releasedTotal);
  // Memoized: the data-tip hook re-renders the card on every mousemove.
  const series = useMemo(() => buildDrawSeries(invoices), [invoices]);
  const { monthYear, pctFmt } = useMemo(
    () => ({
      monthYear: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
      pctFmt: new Intl.NumberFormat(locale, { style: "percent" }),
    }),
    [locale]
  );
  const fig = (value: string) => (loading ? PLACEHOLDER : value);

  // Segment widths clamp so the drawn slices never overflow the pill even if
  // more was drawn than the recorded credit (a state settings validation is
  // meant to prevent): the denominator grows to the drawn total in that case.
  const segmentDenominator = Math.max(metrics.credit, series.totalDrawn);
  const segmentPct = (amount: number) =>
    segmentDenominator > 0 ? (amount / segmentDenominator) * 100 : 0;

  const overDrawn = metrics.remaining < 0;

  return (
    <div
      className="folio-card p-6"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-testid="bank-release-chart"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold">{t("title")}</span>
        {!loading && series.draws.length > 0 ? (
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {t("drawsMeta", {
              count: series.draws.length,
              first: monthYear.format(monthDate(series.draws[0].date)),
              last: monthYear.format(monthDate(series.draws[series.draws.length - 1].date)),
            })}
          </span>
        ) : null}
      </div>

      {metrics.hasCredit ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {overDrawn && !loading ? (
              <span className="label-cap w-full" style={{ color: "var(--muted)" }}>
                {t("overDrawn")}
              </span>
            ) : null}
            <span
              className="num text-[42px] font-medium leading-none"
              style={{
                letterSpacing: "-.02em",
                color: overDrawn && !loading ? "var(--negative)" : undefined,
              }}
              data-testid="bank-release-remaining"
            >
              {fig(formatEURWhole(Math.abs(metrics.remaining)))}
            </span>
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>
              {t.rich("headlineMeta", {
                credit: fig(formatEURWhole(metrics.credit)),
                pct: fig(pctFmt.format(metrics.pct / 100)),
                c: (chunks) => (
                  <span className="num" style={{ color: "var(--ink-2)" }}>
                    {chunks}
                  </span>
                ),
                p: (chunks) => (
                  <span className="num" style={{ color: "var(--accent-ink)" }}>
                    {chunks}
                  </span>
                ),
              })}
            </span>
          </div>

          {/* Segmented credit track: one slice per draw, hatched tail = left */}
          {!loading ? (
            <>
              <div
                className="mt-[18px] flex h-7 gap-[2px] overflow-hidden rounded-full"
                data-testid="bank-release-track"
              >
                {series.draws.map((draw, i) => (
                  <span
                    key={draw.id}
                    className="flex-none"
                    data-tip={`${draw.number} · ${formatDate(draw.date)}|${formatEURWhole(
                      draw.amount
                    )}`}
                    // Each segment gives back its 2px flex gap so the hatched
                    // tail keeps its exact remaining share — otherwise the
                    // shrinkable tail absorbs all N gaps and vanishes while
                    // the headline still shows money left at the bank.
                    style={{
                      width: `calc(${segmentPct(draw.amount)}% - 2px)`,
                      background: i % 2 === 1 ? SEGMENT_ALT : "var(--ink-2)",
                    }}
                  />
                ))}
                {metrics.remaining > 0 ? (
                  <span
                    className="flex min-w-0 flex-1 items-center justify-center overflow-hidden"
                    style={{ background: TRACK_HATCH }}
                  >
                    <span
                      className="num whitespace-nowrap text-[11px] font-semibold"
                      style={{ color: "var(--accent-ink)" }}
                    >
                      {t("leftLabel", { amount: formatEURWhole(metrics.remaining) })}
                    </span>
                  </span>
                ) : null}
              </div>
              <div
                className="mt-1.5 flex justify-between gap-3 text-[10.5px]"
                style={{ color: "var(--muted)" }}
              >
                <span>
                  {t.rich("segmentHint", {
                    amount: formatEURWhole(series.totalDrawn),
                    a: (chunks) => (
                      <span className="num" style={{ color: "var(--ink-2)" }}>
                        {chunks}
                      </span>
                    ),
                  })}
                </span>
                <span>
                  {t.rich("creditLabel", {
                    amount: formatEURWhole(metrics.credit),
                    a: (chunks) => (
                      <span className="num" style={{ color: "var(--ink-2)" }}>
                        {chunks}
                      </span>
                    ),
                  })}
                </span>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div
          className="mt-4 rounded-lg border border-dashed px-4 py-3 text-[11.5px]"
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

      {/* Draw details live on the track: each segment's hover tip carries the
          draw's number, date and amount — no separate breakdown chart. */}
      {!loading && series.draws.length === 0 ? (
        <div className="mt-4 text-[11.5px]" style={{ color: "var(--muted)" }}>
          {t("noReleases")}
        </div>
      ) : null}

      {/* Stats footer: largest / last draw (no average — removed on request) */}
      {!loading && series.largest && series.last ? (
        <div
          className="mt-4 flex flex-wrap gap-x-9 gap-y-3 border-t pt-3.5"
          style={{ borderColor: "var(--line)" }}
          data-testid="bank-release-stats"
        >
          <div>
            <div
              className="text-[9.5px] font-medium uppercase"
              style={{ letterSpacing: ".1em", color: "var(--muted)" }}
            >
              {t("largestDraw")}
            </div>
            <div className="mt-[3px] text-[14px] font-medium">
              <span className="num">{formatEURWhole(series.largest.amount)}</span>{" "}
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                {monthYear.format(monthDate(series.largest.date))}
              </span>
            </div>
          </div>
          <div>
            <div
              className="text-[9.5px] font-medium uppercase"
              style={{ letterSpacing: ".1em", color: "var(--muted)" }}
            >
              {t("lastDraw")}
            </div>
            <div className="mt-[3px] text-[14px] font-medium">
              <span className="num">{formatEURWhole(series.last.amount)}</span>{" "}
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                {formatDate(series.last.date)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {overlay}
    </div>
  );
}

/** First day of the month for a "YYYY-MM" or "YYYY-MM-DD" key — numeric args
 * avoid the UTC-midnight day-shift of parsing date-only strings. */
function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}
