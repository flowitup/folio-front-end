/**
 * How late an unpaid facture is, counted in Paris calendar days.
 *
 * The stored status is not touched: a facture "sent" whose due date has passed
 * is shown as overdue on screen, and one marked "overdue" by hand shows how
 * many days too. Paid, cancelled and draft factures (and every devis) are
 * never overdue.
 */

import type { BillingDocument } from "@/types/billing";
import { toIsoDate } from "@/lib/billing/document-payload";
import { parisDayKey } from "@/lib/utils/paris-day";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Days past the due date (≥ 1), or null when the facture is not overdue. */
export function overdueDays(
  doc: Pick<BillingDocument, "kind" | "status" | "payment_due_date">,
  today: string = parisDayKey(),
): number | null {
  if (doc.kind !== "facture") return null;
  if (doc.status !== "sent" && doc.status !== "overdue") return null;
  const due = toIsoDate(doc.payment_due_date);
  if (!due) return null;
  const days = dayNumber(today) - dayNumber(due);
  return days > 0 ? days : null;
}
