import type { LaborPaymentsMonthBucket } from "@/types/labor";

/**
 * Unpaid and overpaid amounts of one month, worker by worker — the rule the
 * back end uses for labor_unpaid: one worker's overpayment never settles
 * another worker's debt, and payments with no worker settle nobody (the
 * month row shows those separately as "unassigned").
 */
export function monthSettlement(
  workers: ReadonlyArray<{ worker_id: string; total_cost: number }>,
  bucket: LaborPaymentsMonthBucket | undefined | null,
): { shortfall: number; overpay: number } {
  const paidById = new Map<string, number>();
  for (const w of bucket?.workers ?? []) paidById.set(w.worker_id, w.paid);
  const costById = new Map<string, number>();
  for (const w of workers) costById.set(w.worker_id, (costById.get(w.worker_id) ?? 0) + w.total_cost);

  let shortfall = 0;
  let overpay = 0;
  for (const [id, cost] of costById) {
    const diff = cost - (paidById.get(id) ?? 0);
    if (diff > 0) shortfall += diff;
    else overpay -= diff;
  }
  // Paid workers with no cost that month are overpaid by all they received.
  for (const [id, paid] of paidById) {
    if (!costById.has(id) && paid > 0) overpay += paid;
  }
  return { shortfall, overpay };
}
