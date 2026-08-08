"use client";

/**
 * UnassignedLaborInvoices — renders one "cleanup queue" section for the
 * Payments tab: either the viewed month's labor invoices missing a worker,
 * or the month-independent "no service_month" bucket. Both share the same
 * row shape (invoice number/date/amount + a quick-assign control); the two
 * call sites differ only in title/copy and whether a month-only "assign to
 * this month" action is offered (no-month rows only — see onAssignMonth).
 */

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Label for the optional "assign to this month" per-row button. */
  assignMonthLabel?: string;
  onAssignWorker: (invoiceId: string, workerId: string) => void;
  /** When provided, rows get an extra button that stamps service_month
   *  without requiring a worker pick (used by the "no month" section). */
  onAssignMonth?: (invoiceId: string) => void;
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
                <div className="flex items-center gap-2">
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
                      {onAssignMonth && assignMonthLabel && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onAssignMonth(inv.id)}
                        >
                          {assignMonthLabel}
                        </Button>
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
