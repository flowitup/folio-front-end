"use client";

/**
 * AddRefundableExpenseDialog — picker for promoting expenses into the
 * refundable tracking list.
 *
 * On open it fetches all materials & services expenses that have not yet been
 * marked refundable (refundable_status = null). The admin can search by project
 * name, invoice number, or recipient, select one or more rows, then confirm.
 * Confirming patches each selected expense to refundable_status="refundable"
 * and triggers the parent's onAdded callback.
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchRefundableCandidates,
  setRefundableStatus,
} from "@/lib/api/billing/refundable-invoices";
import type { RefundableExpense } from "@/types/invoice";
import { ApiError } from "@/lib/api/http";
import { formatEUR } from "@/lib/utils/formatters";

/** The API's 400 for an expense already paid with a company payment method. */
function isCompanyPaidRejection(reason: unknown): boolean {
  if (!(reason instanceof ApiError) || reason.status !== 400) return false;
  const data = reason.data as { message?: unknown } | undefined;
  const message = typeof data?.message === "string" ? data.message : reason.message;
  return /paid by the company/i.test(message);
}

interface AddRefundableExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddRefundableExpenseDialog({
  open,
  onOpenChange,
  onAdded,
}: AddRefundableExpenseDialogProps) {
  const t = useTranslations("billing.refundable");

  const [candidates, setCandidates] = useState<RefundableExpense[]>([]);
  const [candidateTotal, setCandidateTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Keep t in a ref so the effect can access the latest value without
  // listing t as a dep (avoids infinite re-render when test mocks return
  // a new function reference per render).
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  // Fetch candidates each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(new Set());
    setError(null);
    setLoading(true);
    fetchRefundableCandidates()
      .then((res) => {
        setCandidates(res.items);
        setCandidateTotal(res.total);
      })
      .catch(() => setError(tRef.current("loadError")))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.project_name.toLowerCase().includes(q) ||
        c.invoice_number.toLowerCase().includes(q) ||
        c.recipient_name.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const ids = [...selected];
      const results = await Promise.allSettled(
        ids.map((id) => setRefundableStatus(id, "refundable"))
      );

      // An expense paid with a company payment method can never be tracked
      // for refund: drop it from the picker and say why, instead of asking
      // for a retry that cannot succeed.
      const companyPaidIds = ids.filter((_, i) => {
        const r = results[i];
        return r.status === "rejected" && isCompanyPaidRejection(r.reason);
      });
      const otherFailures = results.filter(
        (r, i) => r.status === "rejected" && !companyPaidIds.includes(ids[i])
      ).length;
      const succeeded = results.filter((r) => r.status === "fulfilled");

      if (companyPaidIds.length > 0) {
        const numbers = candidates
          .filter((c) => companyPaidIds.includes(c.id))
          .map((c) => c.invoice_number)
          .join(", ");
        toast.error(tRef.current("companyPaidNotRefundable", { numbers }));
        setCandidates((prev) => prev.filter((c) => !companyPaidIds.includes(c.id)));
        setSelected((prev) => new Set([...prev].filter((id) => !companyPaidIds.includes(id))));
      }

      // Always call onAdded if at least one succeeded, so the parent list
      // refetches the items that were successfully marked (callers close the
      // dialog then). When all failed the dialog stays open.
      if (succeeded.length > 0) {
        onAdded();
      }

      if (otherFailures > 0) {
        toast.error(tRef.current("partialAddError"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
        </DialogHeader>

        <Input
          placeholder={t("dialog.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={14} className="animate-spin" />
            <span>{t("loading")}</span>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-4">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">{t("dialog.empty")}</div>
        ) : (
          <div className="overflow-y-auto max-h-72 border rounded-md">
            {candidates.length < candidateTotal && (
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground border-b">
                {t("truncatedNotice", { count: candidates.length, total: candidateTotal })}
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 w-8" />
                  <th className="p-2 font-medium">{t("columns.project")}</th>
                  <th className="p-2 font-medium">{t("columns.invoiceNumber")}</th>
                  <th className="p-2 font-medium">{t("columns.recipient")}</th>
                  <th className="p-2 font-medium text-right">{t("columns.total")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                    onClick={() => toggleRow(expense.id)}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selected.has(expense.id)}
                        onChange={() => toggleRow(expense.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={expense.invoice_number}
                      />
                    </td>
                    <td className="p-2">{expense.project_name}</td>
                    <td className="p-2 font-mono text-xs">{expense.invoice_number}</td>
                    <td className="p-2">{expense.recipient_name}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatEUR(expense.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("dialog.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : null}
            {t("dialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
