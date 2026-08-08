/**
 * Client-side grouping helpers for the Expenses page's month-grouped "All"
 * tab: top-level month sections (newest first, net subtotal), each holding
 * per-type category groups in the canonical ledger order.
 *
 * Pure, framework-free functions operating on an already-fetched Invoice[]
 * (whatever the list fetch returned — tag-filtered or not). Labor invoices
 * bucket by `service_month` (the month the payment is FOR) falling back to
 * `issue_date` when unset; every other type buckets by `issue_date`
 * (locked decision — see brainstorm 260808 invoices-month-grouping).
 */

import type { Invoice, InvoiceType } from "@/types/invoice";

/** Canonical category order inside a month (and for the type-grouped views). */
export const GROUP_ORDER: InvoiceType[] = [
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
];

export interface MonthCategoryGroup {
  type: InvoiceType;
  /** Net Σ total_amount of this type in the month — negative for return-heavy groups. */
  subtotal: number;
  /** Invoices of this type in the month, issue_date desc (invoice_number desc tiebreak). */
  items: Invoice[];
}

export interface InvoiceMonthGroup {
  /** "YYYY-MM" key the section is bucketed under. */
  monthKey: string;
  /** Net Σ total_amount across the month's invoices — returns (negative) included. */
  subtotal: number;
  /** Non-empty category groups, in GROUP_ORDER. */
  categories: MonthCategoryGroup[];
}

/**
 * The "YYYY-MM" month an invoice belongs to: labor uses its `service_month`
 * (stored "YYYY-MM-01") when present so a July-issued "June pay" invoice
 * lands under June; everything else — and service_month-less labor — uses
 * `issue_date`.
 */
export function monthKeyForInvoice(inv: Invoice): string {
  if (inv.type === "labor" && inv.service_month) return inv.service_month.slice(0, 7);
  return inv.issue_date.slice(0, 7);
}

/**
 * Groups invoices into month sections sorted most-recent-first. Within a
 * month, categories follow GROUP_ORDER with empty ones skipped, and rows
 * sort issue_date desc with invoice_number desc as a deterministic tiebreak.
 */
export function groupInvoicesByMonth(invoices: Invoice[]): InvoiceMonthGroup[] {
  const buckets = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const key = monthKeyForInvoice(inv);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(inv);
    else buckets.set(key, [inv]);
  }

  const groups: InvoiceMonthGroup[] = Array.from(buckets.entries()).map(
    ([monthKey, monthInvoices]) => ({
      monthKey,
      subtotal: monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
      categories: GROUP_ORDER.map((type) => {
        const items = monthInvoices
          .filter((inv) => inv.type === type)
          .sort(
            (a, b) =>
              b.issue_date.localeCompare(a.issue_date) ||
              b.invoice_number.localeCompare(a.invoice_number)
          );
        return {
          type,
          subtotal: items.reduce((sum, inv) => sum + inv.total_amount, 0),
          items,
        };
      }).filter((c) => c.items.length > 0),
    })
  );

  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
}
