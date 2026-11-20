"use client";

/**
 * UnassignedLaborInvoices — renders one "cleanup queue" section for the
 * Payments tab: either the viewed month's labor invoices missing a worker,
 * or the month-independent "no service_month" bucket. Both share the same
 * row shape (invoice number/date/amount + a quick-assign control); the two
 * call sites differ only in title/copy and whether a month-only "assign to
 * a month" action is offered (no-month rows only — see onAssignMonth). That
 * action proposes the month of the payment's own date, with "Other month…"
 * opening a month picker.
 */

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthPickerPopover } from "@/components/ui/month-picker";
import { AssignWorkerSelect } from "@/components/labor/assign-worker-select";
import { formatEUR } from "@/lib/api/labor";
import { formatDate } from "@/lib/utils/formatters";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { Invoice } from "@/types/invoice";
import type { Worker } from "@/types/labor";

export interface UnassignedLaborInvoicesProps {
  title: string;
  hint?: string;
  invoices: Invoice[];
  workers: Worker[];
  canManage: boolean;
  isLoading?: boolean;
  emptyMessage: string;
  /** Label of the per-row "assign to {month}" button, for a "YYYY-MM" month. */
  assignMonthLabel?: (month: string) => string;
  /** Label of the button opening a month picker ("Other month…"). */
  otherMonthLabel?: string;
  onAssignWorker: (invoiceId: string, workerId: string) => void;
  /** When provided, rows get buttons that stamp service_month ("YYYY-MM")
   *  without requiring a worker pick (used by the "no month" section). */
  onAssignMonth?: (invoiceId: string, month: string) => void;
  testId: string;
}

export function UnassignedLaborInvoices({
  title,
  hint,
  invoices,
  workers,
  canManage,
  isLoading,
  emptyMessage,
  assignMonthLabel,
  otherMonthLabel,
  onAssignWorker,
  onAssignMonth,
  testId,
}: UnassignedLaborInvoicesProps) {
  const tBuiltins = useTranslations("paymentMethods.builtins");

  return (
    <div className="folio-card overflow-hidden" data-testid={testId}>
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--line)" }}
      >
        <h3 className="font-display text-[15px] font-medium tracking-tight">{title}</h3>
        {hint && (
          <span className="stamp num" data-testid={`${testId}-hint`}>
            {hint}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
          {invoices.map((inv) => {
            const methodLabel = inv.payment_method_label
              ? localizeMethodLabel(inv.payment_method_label, tBuiltins)
              : null;
            // The payment's own month (issue date), not the month being viewed.
            const ownMonth = /^\d{4}-\d{2}/.test(inv.issue_date ?? "") ? inv.issue_date.slice(0, 7) : null;
            return (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                data-testid={`${testId}-row-${inv.id}`}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{inv.invoice_number}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {formatDate(inv.issue_date)}
                    {methodLabel ? ` · ${methodLabel}` : ""}
                  </div>
                </div>
                {/* Wraps on a phone: amount + worker picker, then the month button. */}
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <span className="num text-[13px] font-medium">
                    {formatEUR(inv.total_amount)}
                  </span>
                  {canManage && (
                    <>
                      <AssignWorkerSelect
                        workers={workers}
                        value={inv.worker_id}
                        onChange={(workerId) => onAssignWorker(inv.id, workerId)}
                      />
                      {onAssignMonth && assignMonthLabel && ownMonth && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onAssignMonth(inv.id, ownMonth)}
                          data-testid={`${testId}-assign-month-${inv.id}`}
                        >
                          {assignMonthLabel(ownMonth)}
                        </Button>
                      )}
                      {onAssignMonth && otherMonthLabel && (
                        <MonthPickerPopover
                          value={ownMonth ?? ""}
                          onChange={(m) => onAssignMonth(inv.id, m)}
                          align="end"
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`${testId}-other-month-${inv.id}`}
                          >
                            {otherMonthLabel}
                          </Button>
                        </MonthPickerPopover>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
