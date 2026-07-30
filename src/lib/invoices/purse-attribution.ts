import type { Invoice } from "@/types/invoice";

/**
 * Mirrors the BE bucket rule: a personally-paid expense the company already
 * reimbursed (status refunded, not by bank) counts as company money.
 *
 * Shared by ExpensePursesSummary (purse attribution for the dataviz) and the
 * split/drawer detail surfaces (purse label on a single invoice).
 */
export function isPersonalExpense(inv: Invoice): boolean {
  return (
    Boolean(inv.paid_by_personal) &&
    !(inv.refundable_status === "refunded" && inv.refunded_by !== "bank")
  );
}

/** Which purse label to show for a single invoice's detail view. */
export type PurseLabelKey = "company" | "personal";

/**
 * Purse an invoice's amount is attributed to, for a single-invoice detail
 * display (drawer/split panel). `released_funds` rows are the funding event
 * itself, not spend — they're never attributed to a purse.
 */
export function purseLabelKey(inv: Invoice): PurseLabelKey | null {
  if (inv.type === "released_funds") return null;
  return isPersonalExpense(inv) ? "personal" : "company";
}
