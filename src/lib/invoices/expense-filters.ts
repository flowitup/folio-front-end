import type { Invoice, InvoiceType } from "@/types/invoice";

/** Type-filter selection on the Expense page: the five invoice types plus "all". */
export type ExpenseTabType = "all" | InvoiceType;

/**
 * Case-insensitive substring match over the fields a user would recognize an
 * expense by: recipient, invoice number, any line-item description, notes.
 * An empty/whitespace-only query matches everything.
 */
export function matchesQuery(invoice: Invoice, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (invoice.recipient_name.toLowerCase().includes(query)) return true;
  if (invoice.invoice_number.toLowerCase().includes(query)) return true;
  if (invoice.notes?.toLowerCase().includes(query)) return true;
  return invoice.items.some((item) => item.description.toLowerCase().includes(query));
}

/**
 * Inclusive "YYYY-MM" month-range check against `issue_date`. An empty bound
 * means unbounded on that side; both empty matches everything.
 */
export function inMonthRange(invoice: Invoice, from: string, to: string): boolean {
  const month = invoice.issue_date.slice(0, 7);
  if (from && month < from) return false;
  if (to && month > to) return false;
  return true;
}

/** Per-type + total counts, used for the command-bar chip badges. */
export type ChipCounts = Record<ExpenseTabType, number>;

/** Counts invoices per type plus the "all" total, over an already search/range-filtered list. */
export function chipCounts(invoices: Invoice[]): ChipCounts {
  const counts: ChipCounts = {
    all: invoices.length,
    released_funds: 0,
    labor: 0,
    materials_services: 0,
    others: 0,
    return: 0,
  };
  for (const invoice of invoices) {
    counts[invoice.type] += 1;
  }
  return counts;
}
