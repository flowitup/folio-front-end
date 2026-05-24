"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSelect } from "@/components/invoices/payment-method-select";
import type { CreateInvoicePayload, InvoiceType } from "@/types/invoice";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceFormProps {
  onSubmit: (payload: CreateInvoicePayload) => Promise<void>;
  initialValues?: Partial<CreateInvoicePayload>;
  isLoading?: boolean;
  /**
   * UUID of the company that owns this project.
   * Required to load and create payment methods.
   * When null/undefined, the payment method field is hidden.
   */
  companyId?: string | null;
}

const INVOICE_TYPES: InvoiceType[] = ["released_funds", "labor", "materials_services"];

const emptyItem = (): LineItem => ({ description: "", quantity: 1, unit_price: 0 });

export function InvoiceForm({ onSubmit, initialValues, isLoading, companyId }: InvoiceFormProps) {
  const t = useTranslations("invoices");

  const [type, setType] = useState<InvoiceType>(initialValues?.type ?? "released_funds");
  const [issueDate, setIssueDate] = useState(initialValues?.issue_date ?? "");
  const [recipientName, setRecipientName] = useState(initialValues?.recipient_name ?? "");
  const [recipientAddress, setRecipientAddress] = useState(
    initialValues?.recipient_address ?? ""
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initialValues?.payment_method_id ?? null
  );
  const [items, setItems] = useState<LineItem[]>(
    initialValues?.items && initialValues.items.length > 0
      ? initialValues.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
      : [emptyItem()]
  );
  const [error, setError] = useState<string | null>(null);

  const grandTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const validate = (): string | null => {
    if (!recipientName.trim()) return t("errorRecipientRequired");
    if (items.length === 0) return t("errorAtLeastOneItem");
    for (const item of items) {
      if (!item.description.trim()) return t("errorDescriptionRequired");
      if (item.quantity <= 0) return t("errorQuantityPositive");
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: CreateInvoicePayload = {
      type,
      issue_date: issueDate,
      recipient_name: recipientName.trim(),
      ...(recipientAddress.trim() ? { recipient_address: recipientAddress.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
      // Always include payment_method_id so updates can explicitly clear it (null).
      payment_method_id: paymentMethodId,
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Basic fields */}
      <Card>
        <CardContent className="py-3 px-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium mb-1">{t("type")}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as InvoiceType)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              >
                {INVOICE_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`types.${tp}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-xs font-medium mb-1">{t("issueDate")}</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
            </div>

            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("recipient")} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t("recipient")}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
                required
              />
            </div>

            {/* Payment Method */}
            {companyId && (
              <div>
                <label className="block text-xs font-medium mb-1">{t("paymentMethod.label")}</label>
                <PaymentMethodSelect
                  companyId={companyId}
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Recipient Address */}
          <div>
            <label className="block text-xs font-medium mb-1">
              {t("recipientAddress")}
            </label>
            <textarea
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              rows={1}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1">{t("notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h3 className="text-sm font-semibold">{t("items")}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("addItem")}
            </Button>
          </div>

          <div className="px-3 py-2 space-y-1.5">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-5">{t("description")}</div>
              <div className="col-span-2">{t("quantity")}</div>
              <div className="col-span-3">{t("unitPrice")}</div>
              <div className="col-span-2 text-right">{t("total")}</div>
            </div>

            {items.map((item, index) => {
              const rowTotal = item.quantity * item.unit_price;
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder={t("description")}
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium">
                    {rowTotal.toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(index)}
                      disabled={isLoading || items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="flex justify-end border-t pt-2">
              <span className="text-sm font-semibold">
                {t("totalAmount")}: {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
