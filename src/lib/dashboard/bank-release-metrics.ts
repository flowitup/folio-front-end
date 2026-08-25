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

export interface ReleasePoint {
  /** "YYYY-MM" */
  key: string;
  /** Amount released during that month. */
  amount: number;
  /** Number of release invoices in that month. */
  count: number;
  /** Running total released up to and including that month. */
  cumulative: number;
}

/**
 * Monthly draw-down series built from the project's `released_funds` rows,
 * from the first release month to the last, gaps filled with zero months so
 * the timeline reads continuously. Releases attribute to `issue_date` — the
 * day the bank moved the money — never to `service_month` (a release is not
 * work performed over a period).
 */
export function buildReleaseSeries(invoices: Invoice[]): ReleasePoint[] {
  const byMonth = new Map<string, { amount: number; count: number }>();
  for (const inv of invoices) {
    if (inv.type !== "released_funds") continue;
    const key = inv.issue_date.slice(0, 7);
    const bucket = byMonth.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += inv.total_amount;
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  const keys = [...byMonth.keys()].sort();
  if (keys.length === 0) return [];

  const series: ReleasePoint[] = [];
  let [year, month] = keys[0].split("-").map(Number);
  const [endYear, endMonth] = keys[keys.length - 1].split("-").map(Number);
  let cumulative = 0;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { amount: 0, count: 0 };
    cumulative += bucket.amount;
    series.push({ key, amount: bucket.amount, count: bucket.count, cumulative });
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return series;
}
