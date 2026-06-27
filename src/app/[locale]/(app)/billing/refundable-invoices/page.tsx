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
import { formatDate } from "@/lib/utils/formatters";
import { RefundSourceIndicator } from "@/components/invoices/refund-source-indicator";
import type { RefundableExpense } from "@/types/invoice";

export default function RefundableInvoicesPage() {
  const t = useTranslations("billing.refundable");

  const [items, setItems] = useState<RefundableExpense[]>([]);
  const [total, setTotal] = useState<number>(0);
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

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto">
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
                <th className="pb-2 font-medium">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((expense) => (
                <tr key={expense.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{expense.project_name}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{expense.invoice_number}</td>
                  <td className="py-3 pr-4">{expense.recipient_name}</td>
                  <td className="py-3 pr-4 tabular-nums">{formatDate(expense.issue_date)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {expense.total_amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 pr-4">
                    <RefundableExpenseAttachmentsCell attachments={expense.attachments} />
                  </td>
                  <td className="py-3 pr-4">
                    <RefundSourceIndicator
                      refundable_status={expense.refundable_status}
                      has_bank_refund={expense.has_bank_refund}
                    />
                  </td>
                  <td className="py-3 pr-4" colSpan={2}>
                    <RefundableExpenseRowActions
                      expense={expense}
                      onReload={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
