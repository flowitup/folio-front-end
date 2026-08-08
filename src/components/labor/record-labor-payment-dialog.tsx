"use client";

/**
 * RecordLaborPaymentDialog — slim create-invoice flow scoped to a single
 * labor payment: type is fixed to "labor", service_month is fixed to the
 * viewed month, and there is exactly one line item (amount-focused).
 *
 * Deliberately NOT a reuse of invoice-form.tsx: that form's multi-item,
 * multi-field layout is the right tool for a general invoice but overkill
 * for "pay this worker for this month" — the phase spec calls out a
 * dedicated slim dialog as the fallback when reuse isn't a good fit.
 * Posts directly via createInvoice, same endpoint invoice-form uses.
 *
 * Payment method is optional and only offered when the project has a
 * company (methods are company-scoped — same gate as invoice-form). It
 * feeds the labor payments company/personal split; leaving it empty keeps
 * the payment unattributed, editable later via the normal invoices flow.
 */

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LaborWorkerSelect } from "@/components/invoices/labor-worker-select";
import { PaymentMethodSelect } from "@/components/invoices/payment-method-select";
import { createInvoice } from "@/lib/api/invoice-api";
import { formatMonthYear } from "@/lib/utils/formatters";
import type { Worker } from "@/types/labor";
import type { CreateInvoicePayload } from "@/types/invoice";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RecordLaborPaymentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected worker (row-level trigger). Null from the header trigger —
   *  the user must pick one before saving. */
  worker: Worker | null;
  /** Viewed month, "YYYY-MM" — becomes service_month "YYYY-MM-01" on submit. */
  month: string;
  /** The project's company id. Payment methods are company-scoped, so the
   *  optional method picker only renders when this is set. */
  companyId?: string | null;
  onSaved: () => void;
}

export function RecordLaborPaymentDialog({
  projectId,
  open,
  onOpenChange,
  worker,
  month,
  companyId,
  onSaved,
}: RecordLaborPaymentDialogProps) {
  const t = useTranslations("labor.payments");
  const tLabor = useTranslations("labor");
  const tInvoices = useTranslations("invoices");
  const locale = useLocale();

  const [workerId, setWorkerId] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState<string>("");
  const [issueDate, setIssueDate] = useState(todayKey());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed fields fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const name = worker ? (worker.person_name ?? worker.name) : "";
    setWorkerId(worker?.id ?? null);
    setWorkerName(name);
    setIssueDate(todayKey());
    setDescription(name ? `${name} — ${formatMonthYear(month, locale)}` : "");
    setAmount("");
    setPaymentMethodId(null);
    setError(null);
  }, [open, worker, month, locale]);

  async function handleSave() {
    setError(null);
    if (!workerId) {
      setError(t("errorWorkerRequired"));
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t("errorAmountPositive"));
      return;
    }
    const payload: CreateInvoicePayload = {
      type: "labor",
      issue_date: issueDate,
      recipient_name: workerName,
      items: [
        {
          description: description.trim() || workerName,
          quantity: 1,
          unit_price: numericAmount,
          vat_rate: 0,
        },
      ],
      payment_method_id: paymentMethodId,
      tag_id: null,
      service_month: `${month}-01`,
      worker_id: workerId,
    };
    setIsSaving(true);
    try {
      await createInvoice(projectId, payload);
      toast.success(t("recordedToast"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("recordFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {workerName ? t("recordPaymentFor", { name: workerName }) : t("recordPayment")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!worker && (
            <div>
              <label className="mb-1 block text-xs font-medium">{tInvoices("workerPicker")}</label>
              <LaborWorkerSelect
                projectId={projectId}
                value={workerId}
                onChange={(id, w) => {
                  setWorkerId(id);
                  const name = w ? (w.person_name ?? w.name) : "";
                  setWorkerName(name);
                  setDescription(name ? `${name} — ${formatMonthYear(month, locale)}` : "");
                }}
                disabled={isSaving}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">{tLabor("date")}</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">{tInvoices("description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">{tInvoices("totalAmount")}</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isSaving}
              autoFocus
              data-testid="record-payment-amount"
            />
          </div>

          {companyId && (
            <div>
              <label className="mb-1 block text-xs font-medium">
                {tInvoices("paymentMethod.label")}
              </label>
              <PaymentMethodSelect
                companyId={companyId}
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                disabled={isSaving}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {tLabor("cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tInvoices("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
