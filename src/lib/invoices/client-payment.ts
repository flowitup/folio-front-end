import type { Invoice } from "@/types/invoice";

/**
 * A "released funds" row written when a facture was marked paid: money the
 * client paid, not a bank disbursement. The list and the detail call it
 * "Client payment" rather than "Funds released".
 */
export function isClientPayment(
  invoice: Pick<Invoice, "type" | "source_billing_document_id" | "is_cash_advance">,
): boolean {
  return (
    invoice.type === "released_funds" &&
    !invoice.is_cash_advance &&
    !!invoice.source_billing_document_id
  );
}
