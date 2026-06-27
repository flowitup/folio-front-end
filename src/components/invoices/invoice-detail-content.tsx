"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Printer, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvoiceForm, classifySubmitError } from "@/components/invoices/invoice-form";
import { InvoiceAttachments } from "@/components/invoices/invoice-attachments";
import { updateInvoice, deleteInvoice } from "@/lib/api/invoice-api";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import { REFUND_STATUS_STAMP, REFUND_STATUS_I18N } from "@/lib/invoices/refundable-status-display";
import { formatDate } from "@/lib/utils/formatters";
import { fetchTagsClient } from "@/lib/api/tags-client";
import { TransferToCompanyPaymentAction } from "@/components/invoices/transfer-to-company-payment-action";
import type { Invoice, UpdateInvoicePayload, InvoiceType } from "@/types/invoice";
import type { ProjectTag } from "@/lib/api/tags";

const TYPE_BADGE_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp",
  labor: "stamp accent",
  materials_services: "stamp positive",
  others: "stamp muted",
  refund: "stamp warning",
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
  /**
   * Display name of the construction company associated with this project.
   * When present and invoice has a refundable_status, shown in arrow notation
   * next to the payment method label.
   */
  companyName?: string | null;
  /** Called after a successful update so parent can refresh state. */
  onUpdated: (updated: Invoice) => void;
  /** Called after a successful delete so parent can close/redirect. */
  onDeleted: () => void;
  /**
   * Called after a successful company-payment transfer so the parent list
   * can reload and the detail's displayed status refreshes.
   */
  onTransferred?: () => void;
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
  companyName,
  onUpdated,
  onDeleted,
  onTransferred,
  printUrl,
}: InvoiceDetailContentProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<ProjectTag[]>([]);

  // Load project tags for the edit form tag selector. Non-fatal.
  useEffect(() => {
    fetchTagsClient(invoice.project_id)
      .then(setTags)
      .catch(() => setTags([]));
  }, [invoice.project_id]);

  /** Extract a user-facing message from an API error, falling back to a default. */
  function extractErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const msg =
        (e.data as Record<string, unknown> | undefined)?.message ??
        (e.body as Record<string, unknown> | undefined)?.message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    return err instanceof Error ? err.message : fallback;
  }

  const handleUpdate = async (payload: UpdateInvoicePayload) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateInvoice(invoice.project_id, invoice.id, payload);
      onUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setError(
        classifySubmitError(err, (remaining) =>
          t("errorRefundExceedsSource", { remaining })
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(invoice.project_id, invoice.id);
      onDeleted();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to delete invoice"));
    }
  };

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight font-mono">
            {invoice.invoice_number}
          </h2>
          <span className={TYPE_BADGE_CLASS[invoice.type]}>
            {t(`types.${invoice.type}`)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => window.open(printUrl, "_blank")}>
            <Printer className="h-4 w-4 mr-1" />
            {t("printPdf")}
          </Button>
          {canManage &&
            !isEditing &&
            invoice.type === "materials_services" &&
            invoice.refundable_status == null &&
            !invoice.paid_by_company && (
              <TransferToCompanyPaymentAction
                invoiceId={invoice.id}
                onSuccess={() => onTransferred?.()}
              />
            )}
          {canManage && !isEditing && !invoice.is_auto_generated && (
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
          tags={tags}
          projectId={invoice.project_id}
          editingInvoiceId={invoice.id}
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
              vat_rate: item.vat_rate ?? 0,
            })),
            payment_method_id: invoice.payment_method_id ?? null,
            tag_id: invoice.tag_id ?? null,
            refunds_invoice_id: invoice.refunds_invoice_id ?? null,
          }}
        />
      ) : (
        <>
          {/* Meta */}
          <Card>
            <CardContent className="py-3 px-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("issueDate")}
                  </dt>
                  <dd className="mt-0.5 text-sm">{formatDate(invoice.issue_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("recipient")}
                  </dt>
                  <dd className="mt-0.5 text-sm">{invoice.recipient_name}</dd>
                </div>
                {invoice.recipient_address && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("recipientAddress")}
                    </dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-line">
                      {invoice.recipient_address}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground tracking-wide">
                    {t("paymentMethod.label")}
                  </dt>
                  <dd className="mt-0.5 text-sm flex flex-wrap items-center gap-1.5">
                    {invoice.refundable_status != null && companyName ? (
                      <span className="stamp truncate max-w-[200px]">
                        {invoice.payment_method_label?.trim()
                          ? `${localizeMethodLabel(invoice.payment_method_label, tBuiltins)} → ${companyName}`
                          : `→ ${companyName}`}
                      </span>
                    ) : (
                      <span>
                        {invoice.payment_method_label
                          ? localizeMethodLabel(invoice.payment_method_label, tBuiltins)
                          : t("paymentMethod.none")}
                      </span>
                    )}
                    {invoice.refundable_status != null && (
                      <span className={REFUND_STATUS_STAMP[invoice.refundable_status]}>
                        {t(REFUND_STATUS_I18N[invoice.refundable_status])}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
              {invoice.type === "refund" && invoice.refunds_invoice_number && (
                <div className="mt-2 border-t pt-2">
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("refundsInvoiceLabel")}
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    {t("refundOf", { number: invoice.refunds_invoice_number })}
                  </dd>
                </div>
              )}
              {invoice.notes && (
                <div className="mt-2 border-t pt-2">
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("notes")}
                  </dt>
                  <dd className="mt-0.5 text-base text-foreground whitespace-pre-line">{invoice.notes}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardContent className="p-0">
              {(() => {
                // Show VAT column only when at least one item carries a non-zero rate.
                const hasVat = invoice.items.some((it) => (it.vat_rate ?? 0) > 0);
                const totalHt = invoice.items.reduce(
                  (s, it) => s + it.quantity * it.unit_price,
                  0
                );
                const totalVat = invoice.items.reduce(
                  (s, it) => s + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
                  0
                );

                return (
                  <>
                    {/* Mobile stacked cards — hidden on desktop */}
                    <div className="lg:hidden">
                      {invoice.items.map((item, i) => (
                        <div
                          key={i}
                          className="border-b px-3 py-2.5 last:border-0"
                          style={{ borderColor: "var(--line)" }}
                        >
                          {/* Description full width */}
                          <div className="text-[13px]">{item.description}</div>
                          {/* Qty × UnitPrice on left, Total on right */}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span
                              className="num text-[12px]"
                              style={{ color: "var(--muted)" }}
                            >
                              {item.quantity} × {item.unit_price.toFixed(2)}
                              {hasVat && (item.vat_rate ?? 0) > 0 && (
                                <span className="ml-1">({(item.vat_rate ?? 0)}%)</span>
                              )}
                            </span>
                            <span className="num text-[13px] font-medium">
                              {item.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {/* Totals footer: HT/TVA/TTC when VAT present, otherwise single Total */}
                      {hasVat ? (
                        <>
                          <div
                            className="flex items-center justify-between px-3 py-1.5 border-t"
                            style={{ borderColor: "var(--line)" }}
                          >
                            <span className="text-xs text-muted-foreground">{t("totalHt")}</span>
                            <span className="num text-[13px]">{totalHt.toFixed(2)}</span>
                          </div>
                          <div
                            className="flex items-center justify-between px-3 py-1.5"
                          >
                            <span className="text-xs text-muted-foreground">{t("totalTva")}</span>
                            <span className="num text-[13px]">{totalVat.toFixed(2)}</span>
                          </div>
                          <div
                            className="flex items-center justify-between px-3 py-2 border-t"
                            style={{ background: "var(--paper-2)", borderColor: "var(--line)" }}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("totalTtc")}
                            </span>
                            <span className="num font-bold text-[13px]">
                              {invoice.total_amount.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div
                          className="flex items-center justify-between px-3 py-2 border-t"
                          style={{ background: "var(--paper-2)", borderColor: "var(--line)" }}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("totalAmount")}
                          </span>
                          <span className="num font-bold text-[13px]">
                            {invoice.total_amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Desktop table — hidden on mobile */}
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {t("description")}
                            </th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {t("quantity")}
                            </th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {t("unitPrice")}
                            </th>
                            {hasVat && (
                              <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {t("vatRate")}
                              </th>
                            )}
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {t("total")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.items.map((item, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-3 py-1.5">{item.description}</td>
                              <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                              <td className="px-3 py-1.5 text-right">{item.unit_price.toFixed(2)}</td>
                              {hasVat && (
                                <td className="px-3 py-1.5 text-right">
                                  {(item.vat_rate ?? 0) > 0 ? `${item.vat_rate}%` : "—"}
                                </td>
                              )}
                              <td className="px-3 py-1.5 text-right font-medium">
                                {item.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {hasVat ? (
                            <>
                              <tr>
                                <td
                                  colSpan={hasVat ? 4 : 3}
                                  className="px-3 py-1 text-right text-xs text-muted-foreground"
                                >
                                  {t("totalHt")}
                                </td>
                                <td className="px-3 py-1 text-right text-xs">
                                  {totalHt.toFixed(2)}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  colSpan={hasVat ? 4 : 3}
                                  className="px-3 py-1 text-right text-xs text-muted-foreground"
                                >
                                  {t("totalTva")}
                                </td>
                                <td className="px-3 py-1 text-right text-xs">
                                  {totalVat.toFixed(2)}
                                </td>
                              </tr>
                              <tr className="border-t bg-muted/30">
                                <td
                                  colSpan={hasVat ? 4 : 3}
                                  className="px-3 py-1.5 text-right font-semibold text-sm"
                                >
                                  {t("totalTtc")}
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold">
                                  {invoice.total_amount.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <tr className="border-t bg-muted/30">
                              <td colSpan={3} className="px-3 py-1.5 text-right font-semibold text-sm">
                                {t("totalAmount")}
                              </td>
                              <td className="px-3 py-1.5 text-right font-bold">
                                {invoice.total_amount.toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Attachments */}
          <InvoiceAttachments invoice={invoice} canManage={canManage} />
        </>
      )}
    </div>
  );
}
