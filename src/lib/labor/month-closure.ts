import type { LaborMonthClosure, LaborPaymentsSummaryResponse } from "@/types/labor";

/**
 * Closed labor months ("Chốt tháng", owner decision QĐ-10).
 *
 * A closed month is a marker, not a lock: every write into it still saves,
 * after an in-app "Month X is closed. Save anyway?" and the API records who
 * changed what. These helpers decide which months a write touches.
 */

/** "YYYY-MM" of a "YYYY-MM-DD" day or a "YYYY-MM" month; null for anything else. */
export function monthKeyOf(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(value ?? "");
  return m ? `${m[1]}-${m[2]}` : null;
}

/** "2026-11" → "11/2026": the month as the closure labels show it, in every locale. */
export function formatClosureMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  return m ? `${m[2]}/${m[1]}` : month;
}

/** The closed months (sorted "YYYY-MM") among the days / months a write touches. */
export function closedMonthsFor(
  closures: ReadonlyArray<Pick<LaborMonthClosure, "month">>,
  daysOrMonths: ReadonlyArray<string | null | undefined>,
): string[] {
  const closed = new Set(closures.map((c) => c.month));
  const hit = new Set<string>();
  for (const value of daysOrMonths) {
    const key = monthKeyOf(value);
    if (key && closed.has(key)) hit.add(key);
  }
  return Array.from(hit).sort();
}

/**
 * The closed months a daily-rate change dated `effectiveDate` may reprice:
 * every closed month that ends on or after that day. (The API narrows it to
 * the months where the worker has days; asking a little too often is fine.)
 */
export function closedMonthsFromDate(
  closures: ReadonlyArray<Pick<LaborMonthClosure, "month">>,
  effectiveDate: string | null | undefined,
): string[] {
  const from = monthKeyOf(effectiveDate);
  if (!from) return [];
  return closures
    .map((c) => c.month)
    .filter((m) => m >= from)
    .sort();
}

/**
 * Labor payments that settle nobody in `month`: those of the month with no
 * worker, plus every labor payment with no month at all.
 */
export function unsettledPaymentCount(
  paymentsSummary: LaborPaymentsSummaryResponse | null | undefined,
  month: string,
): number {
  let count = 0;
  for (const b of paymentsSummary?.months ?? []) {
    if (b.year == null || b.month == null) {
      count += b.unassigned_count + b.workers.reduce((n, w) => n + w.invoice_count, 0);
    } else if (`${b.year}-${String(b.month).padStart(2, "0")}` === month) {
      count += b.unassigned_count;
    }
  }
  return count;
}
