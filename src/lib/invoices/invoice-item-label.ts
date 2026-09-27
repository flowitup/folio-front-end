/**
 * The line of the funds release the backend creates for a bank refund is
 * stored in French ("Remboursement banque — INV-2026-0005", a fixed literal
 * kept for the exports). It is translated where it is shown.
 */

const BANK_REFUND_PREFIX = "Remboursement banque — ";

interface InvoiceLike {
  type: string;
  is_auto_generated?: boolean | null;
}

export function invoiceItemLabel(
  invoice: InvoiceLike,
  description: string,
  bankRefundLine: (number: string) => string
): string {
  if (
    invoice.type === "released_funds" &&
    invoice.is_auto_generated &&
    description.startsWith(BANK_REFUND_PREFIX)
  ) {
    return bankRefundLine(description.slice(BANK_REFUND_PREFIX.length));
  }
  return description;
}
