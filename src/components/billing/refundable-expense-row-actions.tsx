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
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";
import type { RefundableExpense, RefundableStatus } from "@/types/invoice";

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
}

export function RefundableExpenseRowActions({
  expense,
  onReload,
}: RefundableExpenseRowActionsProps) {
  const t = useTranslations("billing.refundable");
  const [loading, setLoading] = useState(false);

  const currentStatus = expense.refundable_status;

  async function handleSetStatus(next: RefundableStatus | null) {
    setLoading(true);
    try {
      await setRefundableStatus(expense.id, next);
      onReload();
    } catch {
      toast.error(t("updateError"));
    } finally {
      setLoading(false);
    }
  }

  const stampClass = currentStatus
    ? REFUNDABLE_STATUS_STAMP[currentStatus]
    : "stamp";

  const statusLabel = currentStatus
    ? t(STATUS_I18N_KEY[currentStatus])
    : "—";

  return (
    <div className="flex items-center gap-2">
      <span className={stampClass}>{statusLabel}</span>

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
            onSelect={() => handleSetStatus("refunded")}
            disabled={currentStatus === "refunded"}
          >
            {t("status.refunded")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => handleSetStatus(null)}
            className="text-destructive focus:text-destructive"
          >
            {t("action.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
