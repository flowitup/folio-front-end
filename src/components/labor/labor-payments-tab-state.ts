/**
 * Pure helpers backing LaborPaymentsTab — kept out of the component so the
 * merge/status/default-month logic is unit-testable without rendering React
 * (mirrors the log-day-dialog-state.ts split used by LogDayDialog).
 */

import type {
  LaborMonthlySummaryResponse,
  LaborPaymentsMonthBucket,
  LaborPaymentsSummaryResponse,
  LaborSummaryResponse,
} from "@/types/labor";

export type PaymentStatus = "unpaid" | "partial" | "settled" | "overpaid";

export interface WorkerPaymentRow {
  worker_id: string;
  worker_name: string;
  days_worked: number;
  /** Bonus-inclusive total_cost from labor-summary — the locked "owed" basis. */
  owed: number;
  paid: number;
  /** owed - paid */
  balance: number;
  invoice_count: number;
  status: PaymentStatus;
}

// Rounding tolerance for balance comparisons — labor summary and payment
// sums both derive from float arithmetic, so never compare with `=== 0`.
const BALANCE_EPSILON = 0.01;

/** Classify a worker's payment status from paid vs owed for one month. */
export function statusForBalance(paid: number, owed: number): PaymentStatus {
  const balance = owed - paid;
  if (Math.abs(balance) < BALANCE_EPSILON) return "settled";
  if (paid <= 0) return "unpaid";
  if (paid < owed) return "partial";
  return "overpaid";
}

/**
 * Merge per-worker "owed" (labor-summary rows for the viewed month) with
 * per-worker "paid" (the matching labor-payments-summary month bucket) into
 * one row per worker appearing in EITHER source. Sorted by worker_name.
 */
export function mergeWorkerPaymentRows(
  summary: LaborSummaryResponse | null,
  bucket: LaborPaymentsMonthBucket | null,
): WorkerPaymentRow[] {
  const rows = new Map<string, WorkerPaymentRow>();

  for (const r of summary?.rows ?? []) {
    rows.set(r.worker_id, {
      worker_id: r.worker_id,
      worker_name: r.worker_name,
      days_worked: r.days_worked,
      owed: r.total_cost,
      paid: 0,
      balance: r.total_cost,
      invoice_count: 0,
      status: statusForBalance(0, r.total_cost),
    });
  }

  for (const w of bucket?.workers ?? []) {
    const existing = rows.get(w.worker_id);
    const owed = existing?.owed ?? 0;
    rows.set(w.worker_id, {
      worker_id: w.worker_id,
      worker_name: existing?.worker_name ?? w.worker_name,
      days_worked: existing?.days_worked ?? 0,
      owed,
      paid: w.paid,
      balance: owed - w.paid,
      invoice_count: w.invoice_count,
      status: statusForBalance(w.paid, owed),
    });
  }

  return Array.from(rows.values()).sort((a, b) =>
    a.worker_name.localeCompare(b.worker_name),
  );
}

/** Find the bucket matching a "YYYY-MM" month string, or null if absent. */
export function findMonthBucket(
  paymentsSummary: LaborPaymentsSummaryResponse | null,
  month: string,
): LaborPaymentsMonthBucket | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match || !paymentsSummary) return null;
  const year = Number(match[1]);
  const m = Number(match[2]);
  return (
    paymentsSummary.months.find((b) => b.year === year && b.month === m) ??
    null
  );
}

/** The special "no service_month" bucket, or null if absent. */
export function findNoMonthBucket(
  paymentsSummary: LaborPaymentsSummaryResponse | null,
): LaborPaymentsMonthBucket | null {
  return (
    paymentsSummary?.months.find((b) => b.year === null && b.month === null) ??
    null
  );
}

/** Parse "YYYY-MM" into a `{from, to}` day range, or null on bad input. */
export function monthToDateRange(
  month: string,
): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const [, y, m] = match.map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Default month for the Payments tab = the most recent calendar month that
 * has either labor entries (monthly summary rows) or labor payments
 * (payments-summary buckets, excluding the null "no month" bucket). Falls
 * back to the current month when neither source has any data.
 */
export function pickDefaultMonth(
  monthlyEntries: LaborMonthlySummaryResponse | null,
  paymentsSummary: LaborPaymentsSummaryResponse | null,
  now: Date = new Date(),
): string {
  const candidates: Array<{ year: number; month: number }> = [];
  for (const r of monthlyEntries?.rows ?? []) candidates.push({ year: r.year, month: r.month });
  for (const b of paymentsSummary?.months ?? []) {
    if (b.year != null && b.month != null) candidates.push({ year: b.year, month: b.month });
  }
  if (candidates.length === 0) return ymKey(now.getFullYear(), now.getMonth() + 1);
  const best = candidates.reduce((a, b) =>
    b.year > a.year || (b.year === a.year && b.month > a.month) ? b : a,
  );
  return ymKey(best.year, best.month);
}
