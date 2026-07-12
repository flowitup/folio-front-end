import type { RefundableStatus, RefundedBy } from "@/types/invoice";

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

/**
 * Which sources refunded a materials & services expense.
 * - byCompany: the company reimbursed it (refundable_status reached 'refunded').
 * - byBank:    ≥1 refund invoice links back to it (supplier/vendor sent money back).
 */
export interface RefundSource {
  byCompany: boolean;
  byBank: boolean;
}

/**
 * Derive the refund source from an expense/invoice. Pure — single source of truth
 * shared by the billing page, invoice detail, and mobile card.
 * Company is strictly 'refunded' (NOT 'refund_pending') AND refunded_by is not
 * "bank" (null/absent/"company" all read as company-refunded, covering legacy
 * rows written before refunded_by existed).
 * Bank is either the legacy has_bank_refund signal (≥1 linked refund invoice)
 * OR an explicit refunded_by === "bank" split.
 */
export function getRefundSource(input: {
  refundable_status?: RefundableStatus | null;
  has_bank_refund?: boolean | null;
  refunded_by?: RefundedBy | null;
}): RefundSource {
  const isRefunded = input.refundable_status === "refunded";
  return {
    byCompany: isRefunded && input.refunded_by !== "bank",
    byBank: Boolean(input.has_bank_refund) || (isRefunded && input.refunded_by === "bank"),
  };
}

/**
 * i18n key (relative to the "invoices" namespace) for the combined refund-source
 * tooltip. Returns null when neither source applies (render nothing).
 */
export function refundSourceI18nKey(source: RefundSource): string | null {
  if (source.byCompany && source.byBank) return "refundSource.both";
  if (source.byCompany) return "refundSource.company";
  if (source.byBank) return "refundSource.bank";
  return null;
}
