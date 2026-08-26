/**
 * Pure aggregation helpers for the "remaining to release from the bank" view.
 *
 * The project's credit total (`project.budget`, set in project settings — the
 * crédit immobilier granted by the bank) is the ceiling. Money actually drawn
 * from that credit into the project arrives as `released_funds` invoices, and
 * the backend already sums them into `funds_released_total`. What is left at
 * the bank is therefore `credit − released`.
 *
 * Framework-free so the money math stays unit-testable without React. Mirrors
 * the style of `overview-metrics.ts`, which owns the *spend* side of the same
 * ledger (credit − spent); this file owns the *release* side (credit − drawn).
 */
import type { Invoice } from "@/types/invoice";

export interface BankReleaseMetrics {
  /** Credit granted by the bank. 0 when none has been recorded yet. */
  credit: number;
  /** Sum of released_funds invoices — money already drawn into the project. */
  released: number;
  /** credit − released. Negative when more was drawn than the recorded credit. */
  remaining: number;
  /** True once a positive credit total exists; drives the empty state. */
  hasCredit: boolean;
  /** Released share of the credit, rounded. Unclamped (can exceed 100). */
  pct: number;
  /** Same percent clamped 0–100, for bar widths. */
  pctClamped: number;
}

export function computeBankReleaseMetrics(
  credit: number | null | undefined,
  releasedTotal: number
): BankReleaseMetrics {
  const hasCredit = typeof credit === "number" && credit > 0;
  const creditValue = hasCredit ? (credit as number) : 0;
  const pct = hasCredit ? Math.round((releasedTotal / creditValue) * 100) : 0;
  return {
    credit: creditValue,
    released: releasedTotal,
    remaining: creditValue - releasedTotal,
    hasCredit,
    pct,
    pctClamped: Math.min(Math.max(pct, 0), 100),
  };
}

/** One `released_funds` invoice, reduced to what the draw ledger renders. */
export interface BankDraw {
  id: string;
  /** Invoice number, e.g. "FR-2026-0009" — the draw's identity in tooltips. */
  number: string;
  /** issue_date "YYYY-MM-DD" — the day the bank moved the money. */
  date: string;
  amount: number;
}

export interface DrawSeries {
  /** All draws, oldest first (issue_date, then invoice number). */
  draws: BankDraw[];
  totalDrawn: number;
  /** Biggest single draw (earliest wins a tie). Null when no draws. */
  largest: BankDraw | null;
  /** Most recent draw. Null when no draws. */
  last: BankDraw | null;
}

/**
 * Per-draw ledger built from the project's `released_funds` rows: the ordered
 * draw list (track segments) and the largest/last draw stats. Draws attribute
 * to `issue_date` — the day the bank moved the money — never to
 * `service_month` (a release is not work performed over a period).
 */
export function buildDrawSeries(invoices: Invoice[]): DrawSeries {
  const draws: BankDraw[] = invoices
    .filter((inv) => inv.type === "released_funds")
    .map((inv) => ({
      id: inv.id,
      number: inv.invoice_number,
      date: inv.issue_date,
      amount: inv.total_amount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  let totalDrawn = 0;
  let largest: BankDraw | null = null;
  for (const draw of draws) {
    totalDrawn += draw.amount;
    if (!largest || draw.amount > largest.amount) largest = draw;
  }

  return {
    draws,
    totalDrawn,
    largest,
    last: draws.length > 0 ? draws[draws.length - 1] : null,
  };
}
