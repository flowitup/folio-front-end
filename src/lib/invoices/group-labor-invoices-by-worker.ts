/**
 * Client-side grouping helpers for the Expenses page's worker-grouped labor
 * display (`labor-invoices-by-worker.tsx`).
 *
 * Pure, framework-free functions operating on an already-fetched Invoice[]
 * (whatever the list fetch returned — tag-filtered or not). Grouping is by
 * `worker_id` only: unlinked invoices (worker_id null) ALWAYS land in one
 * "Unassigned" bucket. We never group unlinked invoices by recipient-name
 * similarity — free-text `recipient_name` on legacy rows is not a reliable
 * identity key (locked decision, phase-09 spec).
 */

import type { Invoice } from "@/types/invoice";

export interface WorkerInvoiceGroup {
  /** Worker UUID, or null for the Unassigned group. */
  workerId: string | null;
  /**
   * Display name sourced from the most-recently-issued invoice's
   * `recipient_name` snapshot. Null for the Unassigned group — the caller
   * substitutes the localized "Unassigned" label.
   */
  displayName: string | null;
  invoices: Invoice[];
  /** Sum of `total_amount` across the group's invoices. */
  totalPaid: number;
  invoiceCount: number;
  /**
   * Raw date string for the most recent payment: the max `service_month`
   * across the group when any invoice has one, else the max `issue_date`.
   * Null only if the group is empty (never happens — groups are built from
   * non-empty buckets).
   */
  lastPaymentValue: string | null;
}

export interface MonthInvoiceGroup {
  /** "YYYY-MM" key, or null for the "no service_month" bucket. */
  monthKey: string | null;
  invoices: Invoice[];
}

/** Picks the group's "last payment" value: max service_month, else max issue_date. */
function pickLastPaymentValue(invoices: Invoice[]): string | null {
  const months = invoices
    .map((inv) => inv.service_month)
    .filter((m): m is string => Boolean(m));
  if (months.length > 0) {
    return months.reduce((max, m) => (m > max ? m : max));
  }
  const dates = invoices.map((inv) => inv.issue_date).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max));
}

/** Picks the display name: recipient_name snapshot off the most recent invoice (by issue_date). */
function pickDisplayName(invoices: Invoice[]): string {
  const mostRecent = [...invoices].sort((a, b) => a.issue_date.localeCompare(b.issue_date)).at(-1);
  return mostRecent?.recipient_name ?? "";
}

/**
 * Groups labor invoices by `worker_id`. Sorted alphabetically by display
 * name (locale-aware, case-insensitive via localeCompare); the Unassigned
 * group (worker_id null) always sorts last regardless of its label text.
 */
export function groupLaborInvoicesByWorker(invoices: Invoice[]): WorkerInvoiceGroup[] {
  const buckets = new Map<string | null, Invoice[]>();
  for (const inv of invoices) {
    const key = inv.worker_id ?? null;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(inv);
    else buckets.set(key, [inv]);
  }

  const groups: WorkerInvoiceGroup[] = Array.from(buckets.entries()).map(([workerId, groupInvoices]) => ({
    workerId,
    displayName: workerId ? pickDisplayName(groupInvoices) : null,
    invoices: groupInvoices,
    totalPaid: groupInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    invoiceCount: groupInvoices.length,
    lastPaymentValue: pickLastPaymentValue(groupInvoices),
  }));

  groups.sort((a, b) => {
    if (a.workerId === null) return 1;
    if (b.workerId === null) return -1;
    return (a.displayName ?? "").localeCompare(b.displayName ?? "");
  });

  return groups;
}

/**
 * Groups one worker's invoices by `service_month` ("YYYY-MM" key, derived
 * from the stored "YYYY-MM-01"). Sorted most-recent-first; the "no month"
 * bucket (monthKey null) always sorts last. Within a month, invoices sort
 * by issue_date descending (invoice_number as a deterministic tiebreak).
 */
export function groupInvoicesByServiceMonth(invoices: Invoice[]): MonthInvoiceGroup[] {
  const buckets = new Map<string | null, Invoice[]>();
  for (const inv of invoices) {
    const key = inv.service_month ? inv.service_month.slice(0, 7) : null;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(inv);
    else buckets.set(key, [inv]);
  }

  const groups: MonthInvoiceGroup[] = Array.from(buckets.entries()).map(([monthKey, groupInvoices]) => ({
    monthKey,
    invoices: [...groupInvoices].sort(
      (a, b) => b.issue_date.localeCompare(a.issue_date) || b.invoice_number.localeCompare(a.invoice_number)
    ),
  }));

  groups.sort((a, b) => {
    if (a.monthKey === null) return 1;
    if (b.monthKey === null) return -1;
    return b.monthKey.localeCompare(a.monthKey);
  });

  return groups;
}
