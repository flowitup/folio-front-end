"use client";

/**
 * Button action to mark a materials & services invoice as refundable
 * (initiating the company-payment transfer workflow).
 *
 * Rendered inline with the row's existing delete/actions area.
 * Disabled while the PATCH request is in flight.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/http";
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";

interface TransferToCompanyPaymentActionProps {
  invoiceId: string;
  onSuccess: () => void;
}

export function TransferToCompanyPaymentAction({
  invoiceId,
  onSuccess,
}: TransferToCompanyPaymentActionProps) {
  const t = useTranslations("invoices");
  const [loading, setLoading] = useState(false);

  async function handleTransfer() {
    setLoading(true);
    try {
      await setRefundableStatus(invoiceId, "refundable");
      toast.success(t("refund.transferSuccess"));
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error(t("refund.transferForbidden"));
      } else {
        // Prefer the backend's error message when present, fall back to generic.
        const backendMsg =
          err instanceof ApiError
            ? ((err.data as Record<string, unknown> | undefined)?.message as string | undefined) ??
              ((err.data as Record<string, unknown> | undefined)?.body as string | undefined)
            : undefined;
        toast.error(backendMsg?.trim() || t("refund.transferError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      style={{ color: "var(--muted)" }}
      disabled={loading}
      onClick={handleTransfer}
      aria-label={t("refund.action.transfer")}
      title={t("refund.action.transfer")}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <ArrowRightLeft size={13} />
      )}
    </Button>
  );
}
