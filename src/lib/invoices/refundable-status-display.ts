import type { RefundableStatus } from "@/types/invoice";

/**
 * Maps each refundable status to its CSS stamp class.
 * Single source of truth — imported by page, detail, and mobile card.
 */
export const REFUND_STATUS_STAMP: Record<RefundableStatus, string> = {
  refundable: "stamp",
  refund_pending: "stamp warning",
  refunded: "stamp positive",
};

/**
 * Maps each refundable status to its i18n key (relative to the "invoices" namespace).
 */
export const REFUND_STATUS_I18N: Record<RefundableStatus, string> = {
  refundable: "refund.status.refundable",
  refund_pending: "refund.status.refundPending",
  refunded: "refund.status.refunded",
};
