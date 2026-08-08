"use client";

/**
 * LaborWorkerGroupHistory — the expanded content of one worker group in
 * `labor-invoices-by-worker.tsx`: invoices bucketed under service_month
 * headers (most recent first, "No month" last), each row opening the
 * existing inline detail via the page's `?invoice=<id>` toggle. Unassigned
 * rows additionally carry a quick-assign worker picker.
 */

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AssignWorkerSelect } from "@/components/labor/assign-worker-select";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { formatDate, formatEUR, formatMonthYear } from "@/lib/utils/formatters";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import { groupInvoicesByServiceMonth } from "@/lib/invoices/group-labor-invoices-by-worker";
import type { Invoice } from "@/types/invoice";
import type { Worker } from "@/types/labor";

export interface LaborWorkerGroupHistoryProps {
  invoices: Invoice[];
  variant: "desktop" | "mobile";
  projectId: string;
  canManage: boolean;
  isUnassignedGroup: boolean;
  workers: Worker[];
  companyName: string | null;
  selectedInvoiceId: string | null;
  onToggleInvoice: (id: string) => void;
  onCloseInvoice: () => void;
  onMutated: () => void;
  onAssignWorker: (invoiceId: string, workerId: string) => void;
}

export function LaborWorkerGroupHistory({
  invoices,
  variant,
  projectId,
  canManage,
  isUnassignedGroup,
  workers,
  companyName,
  selectedInvoiceId,
  onToggleInvoice,
  onCloseInvoice,
  onMutated,
  onAssignWorker,
}: LaborWorkerGroupHistoryProps) {
  const t = useTranslations("invoices.byWorker");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const locale = useLocale();
  const monthGroups = groupInvoicesByServiceMonth(invoices);

  return (
    <div className="space-y-3 px-4 pb-4" data-testid={`labor-by-worker-history-${variant}`}>
      {monthGroups.map((mg) => (
        <div key={mg.monthKey ?? "none"}>
          <div
            className="label-cap px-1 pb-1.5 pt-2"
            style={{ color: "var(--muted)" }}
            data-testid={`labor-by-worker-month-${variant}-${mg.monthKey ?? "none"}`}
          >
            {mg.monthKey ? formatMonthYear(mg.monthKey, locale) : t("noMonthGroup")}
          </div>
          <ul className="space-y-1">
            {mg.invoices.map((inv) => {
              const isOpen = selectedInvoiceId === inv.id;
              const methodLabel = inv.payment_method_label
                ? localizeMethodLabel(inv.payment_method_label, tBuiltins)
                : null;
              return (
                <Fragment key={inv.id}>
                  <li
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    // Desktop: fixed grid tracks so number/date/recipient/method/amount
                    // line up as columns across every row and every group (a plain
                    // justify-between flex scatters them at content-dependent
                    // positions). The last track is always reserved so amounts align
                    // whether or not a row carries the quick-assign control.
                    className={
                      variant === "desktop"
                        ? "grid grid-cols-[150px_95px_minmax(0,1fr)_170px_120px_170px] items-center gap-2 rounded-md px-2 py-2 cursor-pointer"
                        : "flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 cursor-pointer"
                    }
                    style={isOpen ? { background: "var(--paper-2)" } : undefined}
                    onClick={() => onToggleInvoice(inv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleInvoice(inv.id);
                      }
                    }}
                    data-testid={`labor-by-worker-invoice-${variant}-${inv.id}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isOpen ? <ChevronDown size={12} style={{ color: "var(--muted)" }} /> : <ChevronRight size={12} style={{ color: "var(--muted)" }} />}
                      <span className="num text-[12.5px] font-medium">{inv.invoice_number}</span>
                    </span>
                    <span className="num text-[12px]" style={{ color: "var(--muted)" }}>
                      {formatDate(inv.issue_date)}
                    </span>
                    {/* Recipient is the ONLY identity an unassigned (legacy free-text)
                        labor invoice has — omitting it makes those rows indistinguishable.
                        In linked groups it would just repeat the group's worker name, so
                        the cell stays empty there (the track remains, keeping columns
                        aligned across groups). */}
                    <span
                      className="min-w-0 flex-1 truncate text-[12.5px]"
                      data-testid={`labor-by-worker-invoice-recipient-${variant}-${inv.id}`}
                    >
                      {isUnassignedGroup ? inv.recipient_name || "—" : ""}
                    </span>
                    <span className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                      {methodLabel ?? "—"}
                    </span>
                    <span className={variant === "desktop" ? "num text-right text-[13px] font-medium" : "num text-[13px] font-medium"}>
                      {formatEUR(inv.total_amount)}
                    </span>
                    {isUnassignedGroup && canManage ? (
                      <span onClick={(e) => e.stopPropagation()}>
                        <AssignWorkerSelect
                          workers={workers}
                          value={inv.worker_id ?? null}
                          onChange={(workerId) => onAssignWorker(inv.id, workerId)}
                        />
                      </span>
                    ) : (
                      variant === "desktop" && <span aria-hidden="true" />
                    )}
                  </li>
                  {isOpen && (
                    <InvoiceDetailRow
                      projectId={projectId}
                      invoiceId={inv.id}
                      canManage={canManage}
                      colSpan={1}
                      regionId={`invoice-detail-by-worker-${variant}-${inv.id}`}
                      onMutated={onMutated}
                      onCollapse={onCloseInvoice}
                      companyName={companyName}
                      asCard
                    />
                  )}
                </Fragment>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
