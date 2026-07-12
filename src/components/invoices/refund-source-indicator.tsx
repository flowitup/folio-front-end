"use client";

/**
 * RefundSourceIndicator — shows which source(s) refunded a materials & services
 * expense: the company (reimbursed, refundable_status === 'refunded') and/or the
 * bank (≥1 linked refund invoice, has_bank_refund).
 *
 * Renders 0–2 small icon badges (company = Building2, bank = Landmark). Self-hides
 * when neither source applies. Single source of truth via getRefundSource, so the
 * billing page, invoice detail, and mobile card all agree.
 */

import { useTranslations } from "next-intl";
import { Building2, Landmark } from "lucide-react";
import {
  getRefundSource,
  refundSourceI18nKey,
} from "@/lib/invoices/refundable-status-display";
import type { RefundableStatus, RefundedBy } from "@/types/invoice";

interface RefundSourceIndicatorProps {
  refundable_status?: RefundableStatus | null;
  has_bank_refund?: boolean | null;
  refunded_by?: RefundedBy | null;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

export function RefundSourceIndicator({
  refundable_status,
  has_bank_refund,
  refunded_by,
  className,
}: RefundSourceIndicatorProps) {
  const t = useTranslations("invoices");
  const source = getRefundSource({ refundable_status, has_bank_refund, refunded_by });
  const tooltipKey = refundSourceI18nKey(source);

  // Nothing to show when neither source refunded this expense.
  if (!tooltipKey) return null;

  const tooltip = t(tooltipKey);

  return (
    <span
      className={`inline-flex items-center gap-1${className ? ` ${className}` : ""}`}
      title={tooltip}
      aria-label={tooltip}
      data-testid="refund-source-indicator"
    >
      {source.byCompany && (
        <Building2
          size={14}
          className="text-emerald-600"
          aria-label={t("refundSource.company")}
          data-testid="refund-source-company"
        />
      )}
      {source.byBank && (
        <Landmark
          size={14}
          className="text-sky-600"
          aria-label={t("refundSource.bank")}
          data-testid="refund-source-bank"
        />
      )}
    </span>
  );
}
