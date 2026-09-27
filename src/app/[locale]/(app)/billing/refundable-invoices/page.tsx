"use client";

/**
 * Refundable Invoices page — company-level admin view.
 *
 * Lists materials & services expenses that are marked refundable (any status),
 * aggregated across all projects the company owns. Admins can advance/clear the
 * refundable status inline and add new refundable expenses via a picker dialog.
 *
 * Auth: inherited from billing/layout.tsx — no additional gate needed here.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRefundableExpenses } from "@/lib/api/billing/refundable-invoices";
import { RefundableExpenseRowActions } from "@/components/billing/refundable-expense-row-actions";
import { RefundableExpenseAttachmentsCell } from "@/components/billing/refundable-expense-attachments-cell";
import { AddRefundableExpenseDialog } from "@/components/billing/add-refundable-expense-dialog";
import { RefundableSummaryCards } from "@/components/billing/refundable-summary-cards";
import { formatDate, formatEUR } from "@/lib/utils/formatters";
import { RefundSourceIndicator } from "@/components/invoices/refund-source-indicator";
import type { RefundableExpense, RefundableSummary } from "@/types/invoice";

/** Who refunded the expense, plus the FR number of a bank refund's funds release. */
function RefundSourceCell({
  expense,
  fundsReleaseLabel,
}: {
  expense: RefundableExpense;
  fundsReleaseLabel: (number: string) => string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RefundSourceIndicator
        refundable_status={expense.refundable_status}
        has_bank_refund={expense.has_bank_refund}
        refunded_by={expense.refunded_by}
      />
      {/* FR number of the funds release auto-created for a bank refund.
          Self-hides when no release is linked. */}
      {expense.funds_release_number && (
        <span
          className="font-mono text-xs text-muted-foreground"
          title={fundsReleaseLabel(expense.funds_release_number)}
          aria-label={fundsReleaseLabel(expense.funds_release_number)}
          data-testid="funds-release-number"
        >
          {expense.funds_release_number}
        </span>
      )}
    </span>
  );
}

export default function RefundableInvoicesPage() {
  const t = useTranslations("billing.refundable");
  const fundsReleaseLabel = (number: string) => t("fundsReleaseLabel", { number });

  const [items, setItems] = useState<RefundableExpense[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState<RefundableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Keep t in a ref so the load callback can access the latest value without
  // being re-created on every render (next-intl's t is stable in production,
  // but test mocks may return a new function reference per render).
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRefundableExpenses();
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={20} />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          {t("addButton")}
        </Button>
      </div>

      <RefundableSummaryCards summary={summary} />

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div>
          {/* Phones: one card per expense, its status menu next to it. */}
          <div className="space-y-2 lg:hidden" data-testid="refundable-cards">
            {items.map((expense) => (
              <div key={expense.id} className="folio-card space-y-1.5 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{expense.project_name}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs">
                    {expense.invoice_number}
                  </span>
                </div>
                <div className="truncate">{expense.recipient_name}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDate(expense.issue_date)}
                  </span>
                  <span className="tabular-nums font-medium">{formatEUR(expense.total_amount)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-2">
                    <RefundSourceCell expense={expense} fundsReleaseLabel={fundsReleaseLabel} />
                    <RefundableExpenseAttachmentsCell attachments={expense.attachments} />
                  </span>
                  <RefundableExpenseRowActions expense={expense} onReload={load} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block" data-testid="refundable-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">{t("columns.project")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.invoiceNumber")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.recipient")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.issueDate")}</th>
                <th className="pb-2 pr-4 font-medium text-right">{t("columns.total")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.invoice")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.refundedBy")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.status")}</th>
                <th className="pb-2 text-right font-medium">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((expense) => (
                <tr key={expense.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{expense.project_name}</td>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs">
                    {expense.invoice_number}
                  </td>
                  <td className="py-3 pr-4">{expense.recipient_name}</td>
                  <td className="py-3 pr-4 tabular-nums">{formatDate(expense.issue_date)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatEUR(expense.total_amount)}
                  </td>
                  <td className="py-3 pr-4">
                    <RefundableExpenseAttachmentsCell attachments={expense.attachments} />
                  </td>
                  <td className="py-3 pr-4">
                    <RefundSourceCell expense={expense} fundsReleaseLabel={fundsReleaseLabel} />
                  </td>
                  <td className="py-3 pr-4">
                    <RefundableExpenseRowActions expense={expense} onReload={load} part="status" />
                  </td>
                  <td className="py-3 text-right">
                    <RefundableExpenseRowActions expense={expense} onReload={load} part="menu" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {items.length < total && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("truncatedNotice", { count: items.length, total })}
            </p>
          )}
        </div>
      )}

      {/* Add refundable expense picker */}
      <AddRefundableExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={() => {
          setDialogOpen(false);
          void load();
        }}
      />
    </div>
  );
}
