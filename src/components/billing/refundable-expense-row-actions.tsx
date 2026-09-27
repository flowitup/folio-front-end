"use client";

/**
 * Inline status control for a single refundable expense row.
 *
 * Shows the current refundable status as a colored stamp, and a DropdownMenu
 * to advance the status or clear it (which removes the expense from the list).
 * Disables itself and shows a spinner while the PATCH request is in flight so
 * double-submissions are impossible.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";
import type { RefundableExpense, RefundableStatus, RefundedBy } from "@/types/invoice";

// Stamp color mapping consistent with billing status badge design system.
export const REFUNDABLE_STATUS_STAMP: Record<RefundableStatus, string> = {
  refundable: "stamp",          // neutral — flagged but not yet in motion
  refund_pending: "stamp warning", // amber — reimbursement in progress
  refunded: "stamp positive",   // green — reimbursement complete
};

// Maps API status values (snake_case) to i18n key suffixes (camelCase).
const STATUS_I18N_KEY: Record<RefundableStatus, string> = {
  refundable: "status.refundable",
  refund_pending: "status.refundPending",
  refunded: "status.refunded",
};

interface RefundableExpenseRowActionsProps {
  expense: RefundableExpense;
  onReload: () => void;
  /**
   * Which half to render: the status stamp, the change-status menu, or both
   * side by side (default). The desktop table puts each half under its own
   * column header.
   */
  part?: "all" | "status" | "menu";
}

export function RefundableExpenseRowActions({
  expense,
  onReload,
  part = "all",
}: RefundableExpenseRowActionsProps) {
  const t = useTranslations("billing.refundable");
  const [loading, setLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const currentStatus = expense.refundable_status;

  async function handleSetStatus(next: RefundableStatus | null, refundedBy?: RefundedBy) {
    setLoading(true);
    try {
      await setRefundableStatus(expense.id, next, refundedBy);
      if (next === null) toast.success(t("removed"));
      onReload();
    } catch {
      toast.error(t("updateError"));
    } finally {
      setLoading(false);
    }
  }

  // Each item is disabled only when it matches the row's EXACT current source,
  // so switching between company / bank / both is always one click.
  // Legacy null (pre-refunded_by rows) reads as company.
  const isRefunded = currentStatus === "refunded";
  const alreadyRefundedByCompany =
    isRefunded && (expense.refunded_by === "company" || expense.refunded_by == null);
  const alreadyRefundedByBank = isRefunded && expense.refunded_by === "bank";
  const alreadyRefundedByBoth = isRefunded && expense.refunded_by === "both";

  const stampClass = currentStatus
    ? REFUNDABLE_STATUS_STAMP[currentStatus]
    : "stamp";

  const statusLabel = currentStatus
    ? t(STATUS_I18N_KEY[currentStatus])
    : "—";

  const stamp = <span className={stampClass}>{statusLabel}</span>;
  if (part === "status") return stamp;

  return (
    <div className="flex items-center gap-2">
      {part === "all" && stamp}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="h-7 px-2"
            aria-label={t("action.changeStatus")}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ChevronDown size={14} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => handleSetStatus("refundable")}
            disabled={currentStatus === "refundable"}
          >
            {t("status.refundable")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSetStatus("refund_pending")}
            disabled={currentStatus === "refund_pending"}
          >
            {t("status.refundPending")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSetStatus("refunded", "company")}
            disabled={alreadyRefundedByCompany}
          >
            {t("action.refundedByCompany")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSetStatus("refunded", "bank")}
            disabled={alreadyRefundedByBank}
          >
            {t("action.refundedByBank")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSetStatus("refunded", "both")}
            disabled={alreadyRefundedByBoth}
          >
            {t("action.refundedByBoth")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            // Removing clears the refund status and deletes a bank refund's
            // funds release: confirm first.
            onSelect={() => setConfirmRemove(true)}
            className="text-destructive focus:text-destructive"
          >
            {t("action.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirm.body", { number: expense.invoice_number })}
              {expense.funds_release_number && (
                <>
                  {" "}
                  {t("removeConfirm.fundsRelease", { number: expense.funds_release_number })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("removeConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleSetStatus(null)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("action.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
