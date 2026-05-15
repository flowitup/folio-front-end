"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceAttachments } from "@/components/invoices/invoice-attachments";
import { updateInvoice, deleteInvoice } from "@/lib/api/invoice-api";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { Invoice, UpdateInvoicePayload, InvoiceType } from "@/types/invoice";

const TYPE_BADGE_CLASS: Record<InvoiceType, string> = {
  client: "bg-blue-100 text-blue-700",
  labor: "bg-orange-100 text-orange-700",
  supplier: "bg-green-100 text-green-700",
};

interface InvoiceDetailContentProps {
  invoice: Invoice;
  canManage: boolean;
  /**
   * UUID of the company that owns this project.
   * Forwarded to InvoiceForm for payment method selection.
   * When null, the payment method field is hidden in edit mode.
   */
  companyId?: string | null;
  /** Called after a successful update so parent can refresh state. */
  onUpdated: (updated: Invoice) => void;
  /** Called after a successful delete so parent can close/redirect. */
  onDeleted: () => void;
  /** Used to open the print page in a new tab. */
  printUrl: string;
}

/**
 * Pure render of an invoice's detail body — view, edit, attachments.
 * Stateless about WHERE it's mounted (modal or full page).
 */
export function InvoiceDetailContent({
  invoice,
  canManage,
  companyId,
  onUpdated,
  onDeleted,
  printUrl,
}: InvoiceDetailContentProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (payload: UpdateInvoicePayload) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateInvoice(invoice.project_id, invoice.id, payload);
      onUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(invoice.project_id, invoice.id);
      onDeleted();
    } catch {
      setError("Failed to delete invoice");
    }
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight font-mono">
            {invoice.invoice_number}
          </h2>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              TYPE_BADGE_CLASS[invoice.type]
            }`}
          >
            {t(`types.${invoice.type}`)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(printUrl, "_blank")}>
            <Printer className="h-4 w-4 mr-1" />
            {t("printPdf")}
          </Button>
          {canManage && !isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isEditing ? (
        <InvoiceForm
          onSubmit={handleUpdate}
          isLoading={isSaving}
          companyId={companyId}
          initialValues={{
            type: invoice.type,
            issue_date: invoice.issue_date,
            recipient_name: invoice.recipient_name,
            recipient_address: invoice.recipient_address ?? undefined,
            notes: invoice.notes ?? undefined,
            items: invoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
            payment_method_id: invoice.payment_method_id ?? null,
          }}
        />
      ) : (
        <>
          {/* Meta */}
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("issueDate")}
                  </dt>
                  <dd className="mt-1 text-sm">{invoice.issue_date}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("recipient")}
                  </dt>
                  <dd className="mt-1 text-sm">{invoice.recipient_name}</dd>
                </div>
                {invoice.recipient_address && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("recipientAddress")}
                    </dt>
                    <dd className="mt-1 text-sm whitespace-pre-line">
                      {invoice.recipient_address}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground tracking-wide">
                    {t("paymentMethod.label")}
                  </dt>
                  <dd className="mt-1 text-sm">
                    {invoice.payment_method_label
                      ? localizeMethodLabel(invoice.payment_method_label, tBuiltins)
                      : t("paymentMethod.none")}
                  </dd>
                </div>
              </dl>
              {invoice.notes && (
                <div className="mt-4 border-t pt-4">
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("notes")}
                  </dt>
                  <dd className="mt-1 text-sm whitespace-pre-line">{invoice.notes}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold">{t("items")}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t("description")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t("quantity")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t("unitPrice")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t("total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3">{item.description}</td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">{item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-sm">
                        {t("totalAmount")}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {invoice.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <InvoiceAttachments invoice={invoice} canManage={canManage} />
        </>
      )}
    </div>
  );
}
