"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSelect } from "@/components/invoices/payment-method-select";
import { LaborWorkerSelect } from "@/components/invoices/labor-worker-select";
import { TagSelect } from "@/components/tags/tag-select";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import type { CreateInvoicePayload, Invoice, InvoiceType, SettledVia } from "@/types/invoice";
import type { ProjectTag } from "@/lib/api/tags";
import { formatEUR } from "@/lib/utils/formatters";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  /** VAT rate as a percentage (0–100). Defaults to 0 when not set. */
  vat_rate: number;
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
  /**
   * Project-scoped phase tags for the tag selector.
   * When empty or omitted, the tag field is hidden.
   */
  tags?: ProjectTag[];
  /**
   * Project ID — required to fetch the M&S invoice list for the refund link selector.
   * When absent, the link selector shows no options (graceful degradation).
   */
  projectId?: string;
  /**
   * ID of the invoice being edited. Excluded from the M&S selector list.
   */
  editingInvoiceId?: string;
}

const INVOICE_TYPES: InvoiceType[] = [
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
];

/**
 * Types that allow mixed-sign (negative) unit_price on line items.
 * For all other types, the input min is clamped to 0.
 */
const MIXED_SIGN_TYPES: ReadonlySet<InvoiceType> = new Set([
  "materials_services",
  "return",
]);

const emptyItem = (): LineItem => ({ description: "", quantity: 1, unit_price: 0, vat_rate: 0 });

export function InvoiceForm({
  onSubmit,
  initialValues,
  isLoading,
  companyId,
  tags = [],
  projectId,
  editingInvoiceId,
}: InvoiceFormProps) {
  const t = useTranslations("invoices");
  const tTags = useTranslations("tags");
  const tBuiltins = useTranslations("paymentMethods.builtins");

  // Default to materials_services — the everyday expense type. released_funds
  // stays selectable but must never be the default: those invoices are
  // normally auto-generated from company payments, and an accidental manual
  // one silently inflates the funds-released total.
  const [type, setType] = useState<InvoiceType>(initialValues?.type ?? "materials_services");
  const [issueDate, setIssueDate] = useState(initialValues?.issue_date ?? "");
  const [recipientName, setRecipientName] = useState(initialValues?.recipient_name ?? "");
  const [recipientAddress, setRecipientAddress] = useState(
    initialValues?.recipient_address ?? ""
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initialValues?.payment_method_id ?? null
  );
  const [tagId, setTagId] = useState<string | null>(initialValues?.tag_id ?? null);
  // Labor-only "payment for month", kept in the UI as "YYYY-MM" (native
  // month input format) and converted to "YYYY-MM-01" on submit.
  const [serviceMonth, setServiceMonth] = useState<string>(
    initialValues?.service_month ? initialValues.service_month.slice(0, 7) : ""
  );
  // Labor-only worker link (UUID or null = "Not linked"). Preselects from
  // initialValues.worker_id on edit; cleared when the type is switched away
  // from labor (see the type <select>'s onChange below).
  const [workerId, setWorkerId] = useState<string | null>(
    initialValues?.worker_id ?? null
  );
  // released_funds-only "company cash advance" flag: this release records money
  // the company handed to a person (e.g. cash for labor) rather than client
  // money arriving. Cleared when the type is switched away from released_funds
  // (the BE clears it server-side too).
  const [isCashAdvance, setIsCashAdvance] = useState<boolean>(
    initialValues?.is_cash_advance ?? false
  );
  const [items, setItems] = useState<LineItem[]>(
    initialValues?.items && initialValues.items.length > 0
      ? initialValues.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          vat_rate: i.vat_rate ?? 0,
        }))
      : [emptyItem()]
  );
  const [error, setError] = useState<string | null>(null);

  // refunds_invoice_id: the M&S invoice this refund is linked to (null = none)
  const [refundsInvoiceId, setRefundsInvoiceId] = useState<string | null>(
    initialValues?.refunds_invoice_id ?? null
  );

  // List of M&S invoices for the link selector (loaded when type === "return")
  const [msInvoices, setMsInvoices] = useState<Invoice[]>([]);
  const [msLoading, setMsLoading] = useState(false);

  // Load M&S invoices when type === "return". Clear when switching away.
  // Using an async IIFE so all setState calls are inside async callbacks,
  // satisfying the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (type !== "return" || !projectId) {
        if (!cancelled) {
          setMsInvoices([]);
          setMsLoading(false);
        }
        return;
      }
      if (!cancelled) setMsLoading(true);
      try {
        const res = await fetchInvoicesWithMeta(projectId, "materials_services");
        if (!cancelled) {
          const filtered = editingInvoiceId
            ? res.invoices.filter((inv) => inv.id !== editingInvoiceId)
            : res.invoices;
          setMsInvoices(filtered);
        }
      } catch {
        if (!cancelled) setMsInvoices([]);
      } finally {
        if (!cancelled) setMsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [type, projectId, editingInvoiceId]);

  // settled_via: how this return was settled — 'cash' (default) or 'avoir'
  // (supplier credit note). null = untouched — either a brand-new return not
  // yet decided, or a legacy row where this field was never set. Stays null
  // on submit unless the user actively picks an option (mirrors refundsInvoiceId).
  const [settledVia, setSettledVia] = useState<SettledVia | null>(
    initialValues?.settled_via ?? null
  );
  // applied_to_invoice_id: the invoice this avoir return pays off. Only
  // meaningful when settledVia === "avoir" — cleared whenever the type/via
  // switches away from an avoir return.
  const [appliedToInvoiceId, setAppliedToInvoiceId] = useState<string | null>(
    initialValues?.applied_to_invoice_id ?? null
  );

  // List of invoices eligible as an avoir's "applied to" target — any type
  // except return/released_funds. Loaded when type === "return" && settledVia
  // === "avoir". Uses a single unfiltered fetch, client-filtered (mirrors the
  // M&S loader above but needs a broader type set, so a server-side ?type=
  // filter doesn't fit in one request).
  const [linkableInvoices, setLinkableInvoices] = useState<Invoice[]>([]);
  const [linkableLoading, setLinkableLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (type !== "return" || settledVia !== "avoir" || !projectId) {
        if (!cancelled) {
          setLinkableInvoices([]);
          setLinkableLoading(false);
        }
        return;
      }
      if (!cancelled) setLinkableLoading(true);
      try {
        const res = await fetchInvoicesWithMeta(projectId);
        if (!cancelled) {
          const filtered = res.invoices.filter(
            (inv) =>
              inv.type !== "return" &&
              inv.type !== "released_funds" &&
              inv.id !== editingInvoiceId
          );
          setLinkableInvoices(filtered);
        }
      } catch {
        if (!cancelled) setLinkableInvoices([]);
      } finally {
        if (!cancelled) setLinkableLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [type, settledVia, projectId, editingInvoiceId]);

  // True when a NEW labor invoice has no worker linked — there's no worker
  // record for the backend to snapshot recipient_name from, so the free-text
  // recipient input reappears and is required (see JSX below). Edit mode
  // stays exempt: existing/legacy rows may predate a worker link.
  const needsUnlinkedLaborRecipient = type === "labor" && !editingInvoiceId && !workerId;
  const recipientNameRequired = type !== "labor" || needsUnlinkedLaborRecipient;

  // Grand total is TTC: qty × unit_price × (1 + vat_rate/100).
  // Legacy items without a vat_rate are treated as 0 % VAT.
  const grandTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price * (1 + (item.vat_rate ?? 0) / 100),
    0
  );

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const validate = (): string | null => {
    // Labor type replaces the recipient text input with the worker picker
    // when a worker is linked (server snapshots recipient_name from the
    // worker record) or when editing a legacy/existing row (kept as-is,
    // optional). But a brand-new labor invoice left "Not linked" has no
    // worker to snapshot from, so the free-text input reappears (see JSX
    // below) and recipient_name is required there too — the backend rejects
    // an empty recipient_name regardless of type.
    if (recipientNameRequired && !recipientName.trim()) return t("errorRecipientRequired");
    // service_month is required for NEW labor invoices only — editing a
    // legacy row that predates this field must not be blocked by it.
    if (type === "labor" && !editingInvoiceId && !serviceMonth) {
      return t("serviceMonthRequired");
    }
    if (items.length === 0) return t("errorAtLeastOneItem");
    for (const item of items) {
      if (!item.description.trim()) return t("errorDescriptionRequired");
      if (item.quantity <= 0) return t("errorQuantityPositive");
      // No unit_price >= 0 check here — sign is user-controlled for mixed-sign types
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
        vat_rate: Number(item.vat_rate ?? 0),
      })),
      // Always include payment_method_id so updates can explicitly clear it (null).
      payment_method_id: paymentMethodId,
      // Always include tag_id so updates can explicitly clear it (null).
      tag_id: tagId,
      // Include refunds_invoice_id, settled_via, and applied_to_invoice_id only
      // for return type (null = no link/unset / clear). settled_via stays null
      // when untouched — see the settledVia state comment above.
      ...(type === "return"
        ? {
            refunds_invoice_id: refundsInvoiceId,
            settled_via: settledVia,
            applied_to_invoice_id: appliedToInvoiceId,
          }
        : {}),
      // Include service_month + worker_id only for labor type
      // (service_month null = cleared/empty; worker_id null = "Not linked")
      ...(type === "labor"
        ? {
            service_month: serviceMonth ? `${serviceMonth}-01` : null,
            worker_id: workerId,
          }
        : {}),
      // Include is_cash_advance only for released_funds (the BE rejects it on
      // every other type); false explicitly clears the flag on edit.
      ...(type === "released_funds" ? { is_cash_advance: isCashAdvance } : {}),
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(classifySubmitError(
        err,
        (remaining: string) => t("errorRefundExceedsSource", { remaining }),
        t("errorServiceMonthNotAllowed"),
        t("errorAppliedExceedsTarget"),
        t("errorWorkerLinkNotAllowed"),
        t("errorWorkerNotInProject")
      ));
    }
  };

  // Whether the current type allows negative unit prices
  const allowNegativePrice = MIXED_SIGN_TYPES.has(type);

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
                onChange={(e) => {
                  const newType = e.target.value as InvoiceType;
                  setType(newType);
                  // Clear the worker link when leaving labor — the BE clears
                  // it server-side too, so keeping stale FE state around
                  // would only mislead a switch-back.
                  if (newType !== "labor") setWorkerId(null);
                  if (newType !== "released_funds") setIsCashAdvance(false);
                }}
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

            {/* Recipient: worker picker for labor, free-text for other types */}
            {type === "labor" ? (
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t("workerPicker")}
                </label>
                <LaborWorkerSelect
                  projectId={projectId}
                  value={workerId}
                  onChange={(id, worker) => {
                    setWorkerId(id);
                    // Snapshot the display name locally too — the backend
                    // re-snapshots recipient_name server-side, but this keeps
                    // the field consistent if displayed before the reload.
                    if (worker) setRecipientName(worker.person_name ?? worker.name);
                  }}
                  disabled={isLoading}
                />
              </div>
            ) : (
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
            )}

            {/* New labor invoice, no worker linked: the picker alone can't
                supply recipient_name (no worker to snapshot from), so fall
                back to the free-text input. Required — an empty
                recipient_name is rejected by the backend. Hidden again once
                a worker is picked, and never shown in edit mode. */}
            {needsUnlinkedLaborRecipient && (
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
                  data-testid="unlinked-labor-recipient-input"
                />
              </div>
            )}

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

            {/* Phase Tag */}
            {tags.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1">{tTags("select.label")}</label>
                <TagSelect
                  tags={tags}
                  value={tagId}
                  onChange={setTagId}
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
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              disabled={isLoading}
            />
          </div>

          {/* Refund type: optional M&S link selector + hint */}
          {type === "return" && (
            <div className="space-y-2">
              {/* Hint */}
              <p className="text-xs text-muted-foreground">{t("refundHint")}</p>

              {/* M&S link selector */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t("refundsInvoiceLabel")}
                </label>
                <select
                  value={refundsInvoiceId ?? ""}
                  onChange={(e) =>
                    setRefundsInvoiceId(e.target.value === "" ? null : e.target.value)
                  }
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading || msLoading}
                  data-testid="refunds-invoice-select"
                >
                  <option value="">{t("refundsInvoiceNone")}</option>
                  {msInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number}
                      {inv.total_amount != null
                        ? ` — ${formatEUR(inv.total_amount)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Settled via: cash refund (default) or avoir credit note */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  {t("settledVia.label")}
                </label>
                <select
                  value={settledVia ?? "cash"}
                  onChange={(e) => {
                    const next = e.target.value as SettledVia;
                    setSettledVia(next);
                    if (next !== "avoir") setAppliedToInvoiceId(null);
                  }}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                  data-testid="settled-via-select"
                >
                  <option value="cash">{t("settledVia.cash")}</option>
                  <option value="avoir">{t("settledVia.avoir")}</option>
                </select>
              </div>

              {/* Applied-to invoice picker — avoir only */}
              {settledVia === "avoir" && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium mb-1">
                    {t("appliedToInvoiceLabel")}
                  </label>
                  <select
                    value={appliedToInvoiceId ?? ""}
                    onChange={(e) =>
                      setAppliedToInvoiceId(e.target.value === "" ? null : e.target.value)
                    }
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isLoading || linkableLoading}
                    data-testid="applied-to-invoice-select"
                  >
                    <option value="">{t("appliedToInvoiceNone")}</option>
                    {linkableInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number}
                        {inv.total_amount != null
                          ? ` — ${formatEUR(inv.total_amount)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {appliedToInvoiceId && (() => {
                    const target = linkableInvoices.find((inv) => inv.id === appliedToInvoiceId);
                    const label = target?.payment_method_label?.trim()
                      ? localizeMethodLabel(target.payment_method_label, tBuiltins)
                      : null;
                    return (
                      <p className="text-xs text-muted-foreground" data-testid="applied-to-method-hint">
                        {label
                          ? t("appliedToMethodHintWithLabel", { label })
                          : t("appliedToMethodHint")}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Labor type: "payment for month" field — required for new invoices,
              optional when editing a legacy row that predates this field */}
          {type === "labor" && (
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("serviceMonth")}
                {!editingInvoiceId && <span className="text-destructive"> *</span>}
              </label>
              <input
                type="month"
                value={serviceMonth}
                onChange={(e) => setServiceMonth(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-1/2"
                disabled={isLoading}
                required={!editingInvoiceId}
                data-testid="service-month-input"
              />
            </div>
          )}

          {/* Released funds: company cash advance flag — this release is company
              money handed to a person, not client money. Excluded from the
              released totals; shown in the company purse as spent. */}
          {type === "released_funds" && (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={isCashAdvance}
                onChange={(e) => setIsCashAdvance(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5"
                data-testid="cash-advance-checkbox"
              />
              <span>
                <span className="font-medium">{t("cashAdvance.label")}</span>
                <span className="block text-muted-foreground">{t("cashAdvance.hint")}</span>
              </span>
            </label>
          )}
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
            {/* Desktop wrapper */}
            <div className="hidden lg:block" data-testid="invoice-items-desktop">
              {/* Header row — desktop only. Cols: desc(4) qty(2) price(2) TVA(2) total(1) del(1) = 12 */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-4">{t("description")}</div>
                <div className="col-span-2">{t("quantity")}</div>
                <div className="col-span-2">{t("unitPrice")}</div>
                <div className="col-span-2">{t("vatRate")}</div>
                <div className="col-span-2 text-right">{t("total")}</div>
              </div>

              {/* Desktop items */}
              {items.map((item, index) => {
                // Row total is TTC: qty × price × (1 + vat/100)
                const rowTotal = item.quantity * item.unit_price * (1 + (item.vat_rate ?? 0) / 100);
                return (
                  <div key={index} className="hidden lg:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
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
                    <div className="col-span-2">
                      <input
                        type="number"
                        {...(allowNegativePrice ? {} : { min: "0" })}
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.vat_rate ?? 0}
                        onChange={(e) =>
                          updateItem(index, "vat_rate", parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                        aria-label={t("vatRate")}
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium">
                      {formatEUR(rowTotal)}
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
            </div>

            {/* Mobile wrapper */}
            <div className="lg:hidden" data-testid="invoice-items-mobile">
              {items.map((item, index) => {
              // Row total is TTC: qty × price × (1 + vat/100)
              const rowTotal = item.quantity * item.unit_price * (1 + (item.vat_rate ?? 0) / 100);
              return (
                <div key={index}>
                  {/* Mobile card layout (< lg) */}
                  <div className="lg:hidden rounded-md border bg-background p-2 space-y-2">
                    {/* Description — full width */}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder={t("description")}
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={isLoading}
                    />
                    {/* Qty + Unit Price — 2-col row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-0.5">{t("quantity")}</label>
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
                      <div>
                        <label className="block text-xs text-muted-foreground mb-0.5">{t("unitPrice")}</label>
                        <input
                          type="number"
                          {...(allowNegativePrice ? {} : { min: "0" })}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    {/* TVA % — full width below qty/price */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-0.5">{t("vatRate")}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.vat_rate ?? 0}
                        onChange={(e) =>
                          updateItem(index, "vat_rate", parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                      />
                    </div>
                    {/* Total (right) + Delete (right) */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t("total")}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatEUR(rowTotal)}</span>
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
                  </div>
                </div>
              );
            })}
            </div>

            {/* Grand Total */}
            <div className="flex justify-end border-t pt-2">
              <span className={`text-sm font-semibold${grandTotal < 0 ? " text-destructive" : ""}`}>
                {t("totalAmount")}: {formatEUR(grandTotal)}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify a submit error, checking for known backend error codes.
 * `formatCapError` receives the remaining amount string and returns the
 * translated RefundExceedsSource message.
 * `serviceMonthNotAllowedMessage`, when provided, is returned verbatim for
 * the backend's `service_month_not_allowed` (service_month set on a
 * non-labor invoice type).
 * `appliedExceedsTargetMessage`, when provided, is returned verbatim for the
 * backend's `AppliedExceedsTarget` (avoir amount exceeds the target
 * invoice's remaining applicable total).
 * `workerLinkNotAllowedMessage`, when provided, is returned verbatim for the
 * backend's `worker_link_not_allowed` (worker_id set on a non-labor type).
 * `workerNotInProjectMessage`, when provided, is returned verbatim for the
 * backend's `worker_not_in_project` (worker_id references another project).
 * Falls back to the raw error message, then a generic fallback.
 */
export function classifySubmitError(
  err: unknown,
  formatCapError: (remaining: string) => string,
  serviceMonthNotAllowedMessage?: string,
  appliedExceedsTargetMessage?: string,
  workerLinkNotAllowedMessage?: string,
  workerNotInProjectMessage?: string
): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Check error code from body or data (ApiError carries .data or .body).
    // The backend returns the discriminator in the `error` field; keep `name`
    // as a fallback for older shapes.
    const body = (e.data ?? e.body) as Record<string, unknown> | undefined;
    const code = (body?.error ?? body?.name) as string | undefined;
    const message = (body?.message ?? e.message) as string | undefined;

    if (
      (code === "RefundExceedsSource" || code === "RefundExceedsSourceError") &&
      typeof message === "string"
    ) {
      // Extract the remaining amount from the backend message (numeric part,
      // sign-aware so a negative remaining isn't shown as positive).
      const match = message.match(/-?[\d]+[.,]?[\d]*/);
      const remaining = match ? match[0] : "—";
      return formatCapError(remaining);
    }

    if (code === "service_month_not_allowed" && serviceMonthNotAllowedMessage) {
      return serviceMonthNotAllowedMessage;
    }

    if (
      (code === "AppliedExceedsTarget" || code === "AppliedAmountExceedsTargetError") &&
      appliedExceedsTargetMessage
    ) {
      return appliedExceedsTargetMessage;
    }

    if (code === "worker_link_not_allowed" && workerLinkNotAllowedMessage) {
      return workerLinkNotAllowedMessage;
    }

    if (code === "worker_not_in_project" && workerNotInProjectMessage) {
      return workerNotInProjectMessage;
    }

    if (typeof message === "string" && message.trim()) return message;
  }
  return err instanceof Error ? err.message : "Failed to save invoice";
}
