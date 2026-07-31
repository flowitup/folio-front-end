import type { Invoice } from "@/types/invoice";

/**
 * Mirrors the BE bucket rule: a personally-paid expense the company already
 * reimbursed (status refunded, not by bank) counts as company money.
 *
 * Used by ExpensePursesSummary for purse attribution in the dataviz.
 */
export function isPersonalExpense(inv: Invoice): boolean {
  return (
    Boolean(inv.paid_by_personal) &&
    !(inv.refundable_status === "refunded" && inv.refunded_by !== "bank")
  );
}
