"use client";

import { useTranslations } from "next-intl";
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
 * row measured against ONE shared scale (the largest type total), so bar
 * lengths are directly comparable across rows.
 *
 * Figures are inherited verbatim from the purse breakdowns the parent already
 * accumulates in its single pass over the unfiltered invoice list, so they are
 * net of returns (a `return` is deducted from the category of the invoice it
 * refunds) and the row totals reconcile with the dark card's total expenses.
 * Nothing is recomputed here — that keeps this block from ever drifting from
 * the cards above it.
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
}

export function ExpenseTypeBreakdown({ company, personal }: ExpenseTypeBreakdownProps) {
  const t = useTranslations("invoices");

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
    };
  })
    // A type nobody spent on is noise, not information. Kept if any figure is
    // non-zero so an over-refunded (net-negative) category still shows up.
    .filter((r) => r.total !== 0 || r.companyCount > 0 || r.personalCount > 0)
    .sort((a, b) => b.total - a.total);

  // The shared denominator. Every bar in the block is measured against it —
  // that is what makes the rows comparable.
  const scale = Math.max(...rows.map((r) => r.total), 0);
  if (rows.length === 0 || scale <= 0) return null;

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  /** Absolute amount → % of the shared scale. Over-refunded (negative)
   * categories collapse to 0 rather than rendering a backwards bar. */
  const segmentWidth = (amount: number): number => {
    if (amount <= 0) return 0;
    return Math.min(100, Math.max(MIN_SEGMENT_PCT, (amount / scale) * 100));
  };

  return (
    <div className="folio-card flex flex-col gap-3.5 p-5" data-testid="expense-type-breakdown">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-semibold">{t("summary.byType")}</div>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("summary.netOfReturns")}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const companyWidth = segmentWidth(row.companyTotal);
          const personalWidth = segmentWidth(row.personalTotal);
          const typeLabel = t(`types.${row.type}`);
          return (
            <div key={row.type} className="flex flex-col gap-1" data-testid={`type-row-${row.type}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-24 flex-none truncate text-[11.5px] sm:w-32"
                  style={{ color: "var(--muted)" }}
                >
                  {typeLabel}
                </span>
                <span
                  className="flex h-[9px] flex-1 overflow-hidden rounded-full"
                  style={{ background: "var(--paper-2)" }}
                  data-testid={`type-bar-${row.type}`}
                >
                  <span
                    className="h-full"
                    data-testid={`type-segment-company-${row.type}`}
                    data-tip={`${typeLabel} · ${t("summary.companyPurse")}|${formatEURWhole(
                      row.companyTotal
                    )}|${t("invoiceCount", { n: row.companyCount })}`}
                    style={{ width: `${companyWidth}%`, background: COMPANY_COLOR }}
                  />
                  <span
                    className="h-full"
                    data-testid={`type-segment-personal-${row.type}`}
                    data-tip={`${typeLabel} · ${t("summary.personalPurse")}|${formatEURWhole(
                      row.personalTotal
                    )}|${t("invoiceCount", { n: row.personalCount })}`}
                    style={{ width: `${personalWidth}%`, background: PERSONAL_COLOR }}
                  />
                </span>
                <span
                  className="num w-[70px] flex-none text-right text-[11.5px] font-medium sm:w-[82px]"
                  data-testid={`type-total-${row.type}`}
                >
                  {formatEURWhole(row.total)}
                </span>
              </div>
              <div
                className="ml-[106px] text-[11px] sm:ml-[138px]"
                style={{ color: "var(--muted)" }}
              >
                {t("summary.paidByCompany")}{" "}
                <span className="num">{formatEURWhole(row.companyTotal)}</span>
                {" · "}
                {t("summary.paidByPersonal")}{" "}
                <span className="num">{formatEURWhole(row.personalTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-1"
        style={{ borderTop: "1px solid var(--paper-2)" }}
      >
        <span className="flex items-center gap-4 pt-2 text-[11px]" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[9px] w-[9px] rounded-[3px]"
              style={{ background: COMPANY_COLOR }}
            />
            {t("summary.paidByCompany")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[9px] w-[9px] rounded-[3px]"
              style={{ background: PERSONAL_COLOR }}
            />
            {t("summary.paidByPersonal")}
          </span>
        </span>
        <span
          className="pt-2 text-[11px]"
          style={{ color: "var(--muted)" }}
          data-testid="type-breakdown-total"
        >
          {t("summary.sumOfTypes")}{" "}
          <span className="num font-medium" style={{ color: "var(--ink)" }}>
            {formatEURWhole(grandTotal)}
          </span>
        </span>
      </div>
    </div>
  );
}
