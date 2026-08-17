"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatEURWhole } from "@/lib/utils/formatters";

/**
 * Type-first companion to the "two purses" summary.
 *
 * The purse cards answer "who paid, and how much of their released funds is
 * left". They cannot answer "what did each type of work cost in total" — their
 * per-type mini-bars are scaled to their OWN purse, so a category's bar length
 * in the company card is not comparable to the same category in the personal
 * card. This block flips the axis: one row per expense type, both purses
 * stacked inside a single bar, and — the point of the whole component — every
 * row measured against ONE shared scale, made explicit by a labelled axis
 * across the top so a bar length can be read as an amount, not just compared.
 *
 * The scale runs to a rounded ceiling above the largest type (see niceAxisMax)
 * rather than to the largest type itself. Ending the axis on a round number is
 * what lets the gridlines carry readable labels; the cost is that the longest
 * bar no longer fills its track, which is a fair trade for an axis you can
 * actually read values off.
 *
 * Figures are inherited verbatim from the purse breakdowns the parent already
 * accumulates in its single pass over the unfiltered invoice list, so they are
 * net of returns (a `return` is deducted from the category of the invoice it
 * refunds) and the row totals reconcile with the dark card's total expenses.
 * Nothing is recomputed here — that keeps this block from ever drifting from
 * the cards above it. Returns themselves are itemised by the credit strip the
 * parent renders below, deliberately not repeated here.
 */

export const EXPENSE_TYPES = ["labor", "materials_services", "others"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export interface PurseBreakdown {
  count: number;
  /** Client-side sum across the three expense types (mini-bar denominator). */
  spent: number;
  types: Record<ExpenseType, { total: number; count: number }>;
  /** Number of `return` invoices netted into this purse (credit-strip drill-down). */
  returnsCount: number;
  /** Sum of those returns' total_amount — negative (credit-strip drill-down). */
  returnsTotal: number;
}

export function emptyBreakdown(): PurseBreakdown {
  return {
    count: 0,
    spent: 0,
    types: {
      labor: { total: 0, count: 0 },
      materials_services: { total: 0, count: 0 },
      others: { total: 0, count: 0 },
    },
    returnsCount: 0,
    returnsTotal: 0,
  };
}

// Same pair the purse dials use, so the legend needs no explanation: the dark
// dial is the company purse, the accent dial is the personal one.
const COMPANY_COLOR = "var(--ink)";
const PERSONAL_COLOR = "var(--accent)";

// Floor for a non-zero segment. On a shared scale a small category can round to
// a sub-pixel width and read as "nothing was spent" — which is a different
// statement from "very little was spent".
const MIN_SEGMENT_PCT = 0.7;

/** Gridline/tick positions as a percentage across the track. */
const AXIS_TICKS = [0, 25, 50, 75, 100] as const;

// Mantissas a tick step is allowed to land on. Chosen so the axis ends on a
// number a reader recognises (15k, 20k, 40k…) instead of one that merely
// happens to be 1/4 of the tallest bar.
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

/**
 * Smallest "round" ceiling at or above `value` that divides into AXIS_TICKS−1
 * equal, readable steps. 55 976 → 60 000 (steps of 15 000).
 */
export function niceAxisMax(value: number): number {
  if (!(value > 0)) return 0;
  const intervals = AXIS_TICKS.length - 1;
  const rawStep = value / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const mantissa = rawStep / magnitude;
  const step = (NICE_STEPS.find((s) => s >= mantissa - 1e-9) ?? 10) * magnitude;
  return step * intervals;
}

interface ExpenseTypeBreakdownProps {
  company: PurseBreakdown;
  personal: PurseBreakdown;
}

interface TypeRow {
  type: ExpenseType;
  companyTotal: number;
  companyCount: number;
  personalTotal: number;
  personalCount: number;
  total: number;
  count: number;
}

export function ExpenseTypeBreakdown({ company, personal }: ExpenseTypeBreakdownProps) {
  const t = useTranslations("invoices");
  const locale = useLocale();

  const rows: TypeRow[] = EXPENSE_TYPES.map((type) => {
    const c = company.types[type];
    const p = personal.types[type];
    return {
      type,
      companyTotal: c.total,
      companyCount: c.count,
      personalTotal: p.total,
      personalCount: p.count,
      total: c.total + p.total,
      count: c.count + p.count,
    };
  })
    // A type nobody spent on is noise, not information. Kept if any figure is
    // non-zero so an over-refunded (net-negative) category still shows up.
    .filter((r) => r.total !== 0 || r.count > 0)
    .sort((a, b) => b.total - a.total);

  const largest = Math.max(...rows.map((r) => r.total), 0);
  if (rows.length === 0 || largest <= 0) return null;

  // The shared denominator. Every bar in the block is measured against it —
  // that is what makes the rows comparable, and the axis what makes them legible.
  const scale = niceAxisMax(largest);
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  /** Absolute amount → % of the shared scale. Over-refunded (negative)
   * categories collapse to 0 rather than rendering a backwards bar. */
  const segmentWidth = (amount: number): number => {
    if (amount <= 0) return 0;
    return Math.min(100, Math.max(MIN_SEGMENT_PCT, (amount / scale) * 100));
  };

  const tickFmt = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 0,
  });

  // Hover tooltips are delegated — the parent summary owns the single
  // useDataTip listener and overlay for every mark inside it.
  return (
    <div className="folio-card flex flex-col gap-4 p-5" data-testid="expense-type-breakdown">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">
          {t("summary.byType")}
        </h2>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("summary.netOfReturns")}
          {" · "}
          {t("summary.sharedScaleTo", { amount: formatEURWhole(scale) })}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Axis. Same three-column grid as the rows below so the ticks land on
            the gridlines rather than near them. */}
        <div className="grid grid-cols-[104px_minmax(0,1fr)_92px] items-end gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)_130px] sm:gap-x-4">
          <span />
          <span className="relative block h-[13px]" data-testid="type-axis">
            {AXIS_TICKS.map((tick) => (
              <span
                key={tick}
                className="num absolute top-0 text-[10px] whitespace-nowrap"
                style={{
                  left: `${tick}%`,
                  // Pull the end labels inside the track instead of letting
                  // them overhang and collide with the neighbouring columns.
                  transform:
                    tick === 0
                      ? "none"
                      : tick === 100
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                  color: "var(--muted-2)",
                }}
              >
                {tickFmt.format((scale * tick) / 100)}
              </span>
            ))}
          </span>
          <span />
        </div>

        {rows.map((row) => {
          const companyWidth = segmentWidth(row.companyTotal);
          const personalWidth = segmentWidth(row.personalTotal);
          const typeLabel = t(`types.${row.type}`);
          const sharePct = grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0;
          // Round the outer ends of the filled run only, so the bar reads as
          // one pill with a straight company/personal seam inside it.
          const companyRadius =
            personalWidth > 0 ? "9999px 0 0 9999px" : "9999px";
          const personalRadius = companyWidth > 0 ? "0 9999px 9999px 0" : "9999px";
          return (
            <div
              key={row.type}
              className="grid grid-cols-[104px_minmax(0,1fr)_92px] items-center gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)_130px] sm:gap-x-4"
              data-testid={`type-row-${row.type}`}
            >
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold leading-tight">{typeLabel}</span>
                <span className="text-[11px] leading-tight" style={{ color: "var(--muted)" }}>
                  {t("invoiceCount", { n: row.count })}
                </span>
              </span>

              <span
                className="relative block h-[18px] overflow-hidden rounded-full"
                style={{ background: "var(--paper-2)" }}
                data-testid={`type-bar-${row.type}`}
              >
                {/* Gridlines sit under the bar, so they show through the empty
                    part of the track and never cross a filled segment. */}
                {AXIS_TICKS.slice(1, -1).map((tick) => (
                  <span
                    key={tick}
                    className="absolute inset-y-0 w-px"
                    style={{ left: `${tick}%`, background: "var(--line-2)" }}
                    aria-hidden
                  />
                ))}
                <span className="absolute inset-0 flex">
                  <span
                    className="h-full"
                    data-testid={`type-segment-company-${row.type}`}
                    data-tip={`${typeLabel} · ${t("summary.companyPurse")}|${formatEURWhole(
                      row.companyTotal
                    )}|${t("invoiceCount", { n: row.companyCount })}`}
                    style={{
                      width: `${companyWidth}%`,
                      background: COMPANY_COLOR,
                      borderRadius: companyRadius,
                    }}
                  />
                  <span
                    className="h-full"
                    data-testid={`type-segment-personal-${row.type}`}
                    data-tip={`${typeLabel} · ${t("summary.personalPurse")}|${formatEURWhole(
                      row.personalTotal
                    )}|${t("invoiceCount", { n: row.personalCount })}`}
                    style={{
                      width: `${personalWidth}%`,
                      background: PERSONAL_COLOR,
                      borderRadius: personalRadius,
                    }}
                  />
                </span>
              </span>

              <span className="flex items-baseline justify-end gap-1.5">
                <span
                  className="num text-[15px] font-medium"
                  data-testid={`type-total-${row.type}`}
                >
                  {formatEURWhole(row.total)}
                </span>
                <span
                  className="num text-[11px]"
                  style={{ color: "var(--muted-2)" }}
                  data-testid={`type-share-${row.type}`}
                >
                  {sharePct}%
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-3"
        style={{ borderTop: "1px solid var(--paper-2)" }}
      >
        <span className="flex items-center gap-4 text-[11px]" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[9px] w-[9px] rounded-full"
              style={{ background: COMPANY_COLOR }}
            />
            {t("summary.paidByCompany")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[9px] w-[9px] rounded-full"
              style={{ background: PERSONAL_COLOR }}
            />
            {t("summary.paidByPersonal")}
          </span>
        </span>
        <span className="text-[11px]" style={{ color: "var(--muted)" }} data-testid="type-breakdown-total">
          {t("summary.sumOfTypes")}{" "}
          <span className="num text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            {formatEURWhole(grandTotal)}
          </span>
        </span>
      </div>
    </div>
  );
}
