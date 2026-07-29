"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import {
  REFUND_STATUS_STAMP,
  REFUND_STATUS_I18N,
  refundStatusI18nKey,
} from "@/lib/invoices/refundable-status-display";
import { formatDate, formatMonthYear } from "@/lib/utils/formatters";
import { RefundSourceIndicator } from "@/components/invoices/refund-source-indicator";
import type { Invoice, InvoiceType } from "@/types/invoice";

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp",
  labor: "stamp accent",
  materials_services: "stamp positive",
  others: "stamp muted",
  return: "stamp warning",
};

interface InvoiceMobileCardProps {
  invoice: Invoice;
  isOpen: boolean;
  onToggle: () => void;
  formatAmount: (n: number) => string;
  children?: React.ReactNode;
  /** Company name for arrow display on refund-tracked invoices. */
  companyName?: string | null;
}

export function InvoiceMobileCard({
  invoice,
  isOpen,
  onToggle,
  formatAmount,
  children,
  companyName,
}: InvoiceMobileCardProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const locale = useLocale();

  return (
    <div
      className="folio-card overflow-hidden"
      style={isOpen ? { background: "var(--paper-2)" } : undefined}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted)" }}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="num text-[12.5px] font-medium">
              {invoice.invoice_number}
            </span>
            <span className={`num text-[14px] font-medium${invoice.total_amount < 0 ? " text-destructive" : ""}`}>
              {formatAmount(invoice.total_amount)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={TYPE_STAMP_CLASS[invoice.type]}>
              {t(`types.${invoice.type}`)}
            </span>
            {invoice.type === "return" && invoice.refunds_invoice_number && (
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("refundOf", { number: invoice.refunds_invoice_number })}
              </span>
            )}
            {invoice.type === "labor" && invoice.service_month && (
              <span className="stamp" data-testid="mobile-card-service-month">
                {formatMonthYear(invoice.service_month, locale)}
              </span>
            )}
            {invoice.refundable_status != null && companyName ? (
              <span className="stamp truncate max-w-[160px]">
                {invoice.payment_method_label?.trim()
                  ? `${localizeMethodLabel(invoice.payment_method_label, tBuiltins)} → ${companyName}`
                  : `→ ${companyName}`}
              </span>
            ) : invoice.payment_method_label?.trim() ? (
              <span className="stamp">
                {localizeMethodLabel(invoice.payment_method_label, tBuiltins)}
              </span>
            ) : null}
            {invoice.refundable_status != null && (
              <span className={REFUND_STATUS_STAMP[invoice.refundable_status]}>
                {t(
                  refundStatusI18nKey(invoice) ??
                    REFUND_STATUS_I18N[invoice.refundable_status]
                )}
              </span>
            )}
            <RefundSourceIndicator
              refundable_status={invoice.refundable_status}
              has_bank_refund={invoice.has_bank_refund}
              refunded_by={invoice.refunded_by}
            />
          </div>
          <div
            className="mt-1.5 flex items-center justify-between text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            <span>{invoice.recipient_name}</span>
            <span className="num">{formatDate(invoice.issue_date)}</span>
          </div>
        </div>
      </button>
      {isOpen && children && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--line)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
