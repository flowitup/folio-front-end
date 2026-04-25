"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Printer, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { fetchInvoice, updateInvoice, deleteInvoice } from "@/lib/api/invoice-api";
import type { Invoice, UpdateInvoicePayload, InvoiceType } from "@/types/invoice";

const TYPE_BADGE_CLASS: Record<InvoiceType, string> = {
  client: "bg-blue-100 text-blue-700",
  labor: "bg-orange-100 text-orange-700",
  supplier: "bg-green-100 text-green-700",
};

export default function InvoiceDetailPage() {
  const t = useTranslations("invoices");
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const projectId = params.id as string;
  const invoiceId = params.invoiceId as string;
  const { user } = useAuth();

  const canManageInvoices =
    user?.permissions?.some(
      (p) => p === "project:manage_invoices" || p === "*:*" || p === "project:*"
    ) ?? false;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInvoice(projectId, invoiceId);
      setInvoice(data);
    } catch {
      setError("Failed to load invoice");
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleUpdate = async (payload: UpdateInvoicePayload) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateInvoice(projectId, invoiceId, payload);
      setInvoice(updated);
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
      await deleteInvoice(projectId, invoiceId);
      router.push(`/${locale}/projects/${projectId}/invoices`);
    } catch {
      setError("Failed to delete invoice");
    }
  };

  const handlePrint = () => {
    window.open(
      `/${locale}/projects/${projectId}/invoices/${invoiceId}/print`,
      "_blank"
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Invoice not found"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${locale}/projects/${projectId}/invoices`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            {t("printPdf")}
          </Button>
          {canManageInvoices && !isEditing && (
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

      {/* Edit mode */}
      {isEditing ? (
        <InvoiceForm
          onSubmit={handleUpdate}
          isLoading={isSaving}
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
          }}
        />
      ) : (
        /* Detail view */
        <div className="space-y-6">
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
                        <td className="px-4 py-3 text-right">
                          {item.unit_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-right font-semibold text-sm"
                      >
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
        </div>
      )}
    </div>
  );
}
