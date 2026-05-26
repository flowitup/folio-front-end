"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { Invoice, InvoiceType } from "@/types/invoice";

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp",
  labor: "stamp accent",
  materials_services: "stamp positive",
  others: "stamp muted",
};

interface InvoiceMobileCardProps {
  invoice: Invoice;
  isOpen: boolean;
  onToggle: () => void;
  formatAmount: (n: number) => string;
  children?: React.ReactNode;
}

export function InvoiceMobileCard({
  invoice,
  isOpen,
  onToggle,
  formatAmount,
  children,
}: InvoiceMobileCardProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");

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
            <span className="num text-[14px] font-medium">
              {formatAmount(invoice.total_amount)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={TYPE_STAMP_CLASS[invoice.type]}>
              {t(`types.${invoice.type}`)}
            </span>
            {invoice.payment_method_label?.trim() && (
              <span className="stamp">
                {localizeMethodLabel(invoice.payment_method_label, tBuiltins)}
              </span>
            )}
          </div>
          <div
            className="mt-1.5 flex items-center justify-between text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            <span>{invoice.recipient_name}</span>
            <span className="num">{invoice.issue_date}</span>
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
