"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSelect } from "@/components/invoices/payment-method-select";
import { LaborWorkerSelect } from "@/components/invoices/labor-worker-select";
import { parisDayKey } from "@/lib/utils/paris-day";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import type { CreateInvoicePayload, Invoice, InvoiceType, SettledVia } from "@/types/invoice";
import { formatEUR } from "@/lib/utils/formatters";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";
import { invoiceTotalTtc, lineTotalTtc } from "@/lib/invoices/invoice-totals";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import { MAX_LINE_QUANTITY, MAX_LINE_UNIT_PRICE, MAX_VAT_RATE } from "@/lib/numeric-bounds";
import {
  MAX_BUSINESS_DATE,
  MAX_BUSINESS_MONTH,
  MAX_BUSINESS_YEAR,
  MIN_BUSINESS_DATE,
  MIN_BUSINESS_MONTH,
  MIN_BUSINESS_YEAR,
  isBusinessDate,
} from "@/lib/date-bounds";

/**
 * A line as typed. The figures stay raw text ("45,90", "-", "") and are only
 * read for the totals and on submit: rewriting a half-typed "45," as 0 under
 * the cursor turned "45,90" into 4590.
 */
interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  /** VAT rate as a percentage (0–100); empty reads as 0. */
  vat_rate: string;
}

/** Decimals kept per figure — the precision the totals and the API handle exactly. */
const QUANTITY_DECIMALS = 4;
const UNIT_PRICE_DECIMALS = 4;
const VAT_RATE_DECIMALS = 2;

/**
 * A line's figures read in any of the app's locales ("45,90" or "45.90"), each
 * null when it cannot be read. Signs are read here and checked by the caller.
 */
function parseLine(item: LineItem) {
  return {
    quantity: parseMoneyInput(item.quantity, { maxDecimals: QUANTITY_DECIMALS, allowNegative: true }),
    unit_price: parseMoneyInput(item.unit_price, { maxDecimals: UNIT_PRICE_DECIMALS, allowNegative: true }),
    // An emptied VAT field means no VAT, like a legacy line without a rate.
    vat_rate: item.vat_rate.trim()
      ? parseMoneyInput(item.vat_rate, { maxDecimals: VAT_RATE_DECIMALS, allowNegative: true })
      : 0,
  };
}

/** The line as the live totals read it: a figure still being typed counts as 0. */
function lineForTotals(item: LineItem) {
  const { quantity, unit_price, vat_rate } = parseLine(item);
  return { quantity: quantity ?? 0, unit_price: unit_price ?? 0, vat_rate: vat_rate ?? 0 };
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
   * Project ID — required to fetch the M&S invoice list for the refund link selector.
   * When absent, the link selector shows no options (graceful degradation).
   */
  projectId?: string;
  /**
   * ID of the invoice being edited. Excluded from the M&S selector list.
   */
  editingInvoiceId?: string;
  /**
   * Whether the caller holds `project:view_budget`. False drops "Released
   * funds" from the type picker — the backend refuses to record or retype a
   * release without it, so offering the option would only produce a 403.
   * Defaults to true so callers that never surface releases stay unchanged.
   */
  canRecordReleases?: boolean;
  /**
   * Label snapshot of the invoice's current payment method, shown when that
   * method is no longer in the active list (deactivated since).
   */
  paymentMethodLabel?: string | null;
}

const INVOICE_TYPES: InvoiceType[] = [
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
];

const SPEND_ONLY_INVOICE_TYPES: InvoiceType[] = INVOICE_TYPES.filter(
  (t) => t !== "released_funds"
);

/**
 * Types that allow mixed-sign (negative) unit_price on line items.
 * For all other types, a negative price is refused on submit.
 */
const MIXED_SIGN_TYPES: ReadonlySet<InvoiceType> = new Set([
  "materials_services",
  "return",
]);

const emptyItem = (): LineItem => ({ description: "", quantity: "1", unit_price: "0", vat_rate: "0" });

export function InvoiceForm({
  onSubmit,
  initialValues,
  isLoading,
  companyId,
  projectId,
  editingInvoiceId,
  canRecordReleases = true,
  paymentMethodLabel,
}: InvoiceFormProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");

  // Default to materials_services — the everyday expense type. released_funds
  // stays selectable but must never be the default: those invoices are
  // normally auto-generated from company payments, and an accidental manual
  // one silently inflates the funds-released total.
  const [type, setType] = useState<InvoiceType>(initialValues?.type ?? "materials_services");
  // A new expense is issued today (the Paris day) unless the user says otherwise.
  const [issueDate, setIssueDate] = useState(
    initialValues?.issue_date ?? (editingInvoiceId ? "" : parisDayKey())
  );
  const [recipientName, setRecipientName] = useState(initialValues?.recipient_name ?? "");
  const [recipientAddress, setRecipientAddress] = useState(
    initialValues?.recipient_address ?? ""
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initialValues?.payment_method_id ?? null
  );
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
          quantity: String(i.quantity),
          unit_price: String(i.unit_price),
          vat_rate: String(i.vat_rate ?? 0),
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

  // Grand total is TTC: qty × unit_price × (1 + vat_rate/100), computed and
  // rounded exactly like the API so the preview matches the saved amount.
  const grandTotal = invoiceTotalTtc(items.map(lineForTotals));

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
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
    // The API refuses a date outside these years; "0026" for "2026" is the usual typo.
    const dateRange = { min: String(MIN_BUSINESS_YEAR), max: String(MAX_BUSINESS_YEAR) };
    if (!issueDate) return t("errorIssueDateRequired");
    if (!isBusinessDate(issueDate)) return t("errorDateOutOfRange", dateRange);
    if (recipientNameRequired && !recipientName.trim()) return t("errorRecipientRequired");
    // service_month is required for NEW labor invoices only — editing a
    // legacy row that predates this field must not be blocked by it.
    if (type === "labor" && !editingInvoiceId && !serviceMonth) {
      return t("serviceMonthRequired");
    }
    if (type === "labor" && serviceMonth && !isBusinessDate(serviceMonth)) {
      return t("errorDateOutOfRange", dateRange);
    }
    if (items.length === 0) return t("errorAtLeastOneItem");
    for (const item of items) {
      if (!item.description.trim()) return t("errorDescriptionRequired");
      const { quantity, unit_price, vat_rate } = parseLine(item);
      if (quantity === null) return t("errorQuantityInvalid", { decimals: QUANTITY_DECIMALS });
      if (quantity <= 0) return t("errorQuantityPositive");
      if (quantity > MAX_LINE_QUANTITY) {
        return t("errorQuantityTooLarge", { max: MAX_LINE_QUANTITY });
      }
      if (unit_price === null) return t("errorUnitPriceInvalid", { decimals: UNIT_PRICE_DECIMALS });
      // Negative lines (credits) are only for the mixed-sign types.
      if (unit_price < 0 && !MIXED_SIGN_TYPES.has(type)) return t("errorUnitPriceNegative");
      if (Math.abs(unit_price) > MAX_LINE_UNIT_PRICE) {
        return t("errorUnitPriceTooLarge", { max: MAX_LINE_UNIT_PRICE });
      }
      if (vat_rate === null || vat_rate < 0 || vat_rate > MAX_VAT_RATE) {
        return t("errorVatRateInvalid", { decimals: VAT_RATE_DECIMALS });
      }
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
      // On edit both are always sent: an emptied field goes as "" so the API clears it
      // (a missing key means "keep", which brought the old text back).
      ...(editingInvoiceId || recipientAddress.trim() ? { recipient_address: recipientAddress.trim() } : {}),
      ...(editingInvoiceId || notes.trim() ? { notes: notes.trim() } : {}),
      // validate() has checked every figure reads as a number.
      items: items.map((item) => ({
        description: item.description.trim(),
        ...lineForTotals(item),
      })),
      // Include payment_method_id on create, and on edit only when it changed
      // (null explicitly clears it). Re-sending an unchanged method that has
      // since been deactivated would make every edit of the expense fail.
      ...(!editingInvoiceId ||
      paymentMethodId !== (initialValues?.payment_method_id ?? null)
        ? { payment_method_id: paymentMethodId }
        : {}),
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
        t("errorWorkerNotInProject"),
        t("errorPaymentMethodInactive"),
        invoiceValidationMessages(t)
      ));
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
              <label htmlFor="invoice-type" className="block text-xs font-medium mb-1">{t("type")}</label>
              <select
                id="invoice-type"
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
                {(canRecordReleases ? INVOICE_TYPES : SPEND_ONLY_INVOICE_TYPES).map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`types.${tp}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label htmlFor="invoice-issue-date" className="block text-xs font-medium mb-1">
                {t("issueDate")}
                <span className="text-destructive"> *</span>
              </label>
              <input
                id="invoice-issue-date"
                type="date"
                aria-required="true"
                min={MIN_BUSINESS_DATE}
                max={MAX_BUSINESS_DATE}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
            </div>

            {/* Recipient: worker picker for labor, free-text for other types */}
            {type === "labor" ? (
              <div>
                <label htmlFor="invoice-worker" className="block text-xs font-medium mb-1">
                  {t("workerPicker")}
                </label>
                <LaborWorkerSelect
                  id="invoice-worker"
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
                <label htmlFor="invoice-recipient" className="block text-xs font-medium mb-1">
                  {t("recipient")} <span className="text-destructive">*</span>
                </label>
                <input
                  id="invoice-recipient"
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
                <label htmlFor="invoice-unlinked-recipient" className="block text-xs font-medium mb-1">
                  {t("recipient")} <span className="text-destructive">*</span>
                </label>
                <input
                  id="invoice-unlinked-recipient"
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
                <label htmlFor="invoice-payment-method" className="block text-xs font-medium mb-1">
                  {t("paymentMethod.label")}
                </label>
                <PaymentMethodSelect
                  id="invoice-payment-method"
                  companyId={companyId}
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  disabled={isLoading}
                  fallbackSelectedLabel={
                    paymentMethodId && paymentMethodId === (initialValues?.payment_method_id ?? null)
                      ? paymentMethodLabel
                      : null
                  }
                />
              </div>
            )}
          </div>

          {/* Recipient Address */}
          <div>
            <label htmlFor="invoice-recipient-address" className="block text-xs font-medium mb-1">
              {t("recipientAddress")}
            </label>
            <textarea
              id="invoice-recipient-address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              rows={1}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="invoice-notes" className="block text-xs font-medium mb-1">{t("notes")}</label>
            <textarea
              id="invoice-notes"
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
                <label htmlFor="invoice-refunds-invoice" className="block text-xs font-medium mb-1">
                  {t("refundsInvoiceLabel")}
                </label>
                <select
                  id="invoice-refunds-invoice"
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
                <label htmlFor="invoice-settled-via" className="block text-xs font-medium mb-1">
                  {t("settledVia.label")}
                </label>
                <select
                  id="invoice-settled-via"
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
                  <label htmlFor="invoice-applied-to" className="block text-xs font-medium mb-1">
                    {t("appliedToInvoiceLabel")}
                  </label>
                  <select
                    id="invoice-applied-to"
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
              <label htmlFor="invoice-service-month" className="block text-xs font-medium mb-1">
                {t("serviceMonth")}
                {!editingInvoiceId && <span className="text-destructive"> *</span>}
              </label>
              <input
                id="invoice-service-month"
                type="month"
                min={MIN_BUSINESS_MONTH}
                max={MAX_BUSINESS_MONTH}
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
                // Row total is TTC: qty × price × (1 + vat/100), rounded like the API
                const rowTotal = lineTotalTtc(lineForTotals(item));
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
                        aria-label={t("description")}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                        aria-label={t("quantity")}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isLoading}
                        aria-label={t("unitPrice")}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.vat_rate}
                        onChange={(e) => updateItem(index, "vat_rate", e.target.value)}
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
                        aria-label={t("removeLine")}
                        title={t("removeLine")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile wrapper */}
            <div className="lg:hidden" data-testid="invoice-items-mobile">
              {items.map((item, index) => {
              // Row total is TTC: qty × price × (1 + vat/100), rounded like the API
              const rowTotal = lineTotalTtc(lineForTotals(item));
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
                      aria-label={t("description")}
                    />
                    {/* Qty + Unit Price — 2-col row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor={`invoice-line-${index}-quantity`}
                          className="block text-xs text-muted-foreground mb-0.5"
                        >
                          {t("quantity")}
                        </label>
                        <input
                          id={`invoice-line-${index}-quantity`}
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`invoice-line-${index}-unit-price`}
                          className="block text-xs text-muted-foreground mb-0.5"
                        >
                          {t("unitPrice")}
                        </label>
                        <input
                          id={`invoice-line-${index}-unit-price`}
                          type="text"
                          inputMode="decimal"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    {/* TVA % — full width below qty/price */}
                    <div>
                      <label
                        htmlFor={`invoice-line-${index}-vat-rate`}
                        className="block text-xs text-muted-foreground mb-0.5"
                      >
                        {t("vatRate")}
                      </label>
                      <input
                        id={`invoice-line-${index}-vat-rate`}
                        type="text"
                        inputMode="decimal"
                        value={item.vat_rate}
                        onChange={(e) => updateItem(index, "vat_rate", e.target.value)}
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
                          aria-label={t("removeLine")}
                          title={t("removeLine")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
 * `validationMessages` pairs a pattern on a `ValidationError` message with the
 * translated text to show instead (see `invoiceValidationMessages`).
 * Falls back to the raw error message, then a generic fallback.
 */
export function classifySubmitError(
  err: unknown,
  formatCapError: (remaining: string) => string,
  serviceMonthNotAllowedMessage?: string,
  appliedExceedsTargetMessage?: string,
  workerLinkNotAllowedMessage?: string,
  workerNotInProjectMessage?: string,
  paymentMethodInactiveMessage?: string,
  validationMessages: ReadonlyArray<readonly [RegExp, string]> = []
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
      // Shown as money ("1 243,10 €"), not the API's raw "1243.10".
      const match = message.match(/-?[\d]+[.,]?[\d]*/);
      const amount = match ? Number(match[0].replace(",", ".")) : NaN;
      return formatCapError(Number.isFinite(amount) ? formatEUR(amount) : "—");
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

    // 409 "Conflict" is shared; the inactive-method case is told apart by its text.
    if (
      code === "Conflict" &&
      typeof message === "string" &&
      /inactive/i.test(message) &&
      paymentMethodInactiveMessage
    ) {
      return paymentMethodInactiveMessage;
    }

    if (code === "ValidationError" && typeof message === "string") {
      const known = validationMessages.find(([pattern]) => pattern.test(message));
      if (known) return known[1];
    }

    if (typeof message === "string" && message.trim()) return message;
  }
  return err instanceof Error ? err.message : "Failed to save invoice";
}

/**
 * Translations for the refusals the API words in English only: moving a
 * refund-tracked expense onto a company payment method, turning an invoice
 * that avoirs are applied to into a return or a funds release, touching a
 * refunded expense, saving a return with a positive total, and deleting or
 * retyping a purchase that returns are linked to.
 */
export function invoiceValidationMessages(
  t: (
    key:
      | "errorCompanyPaidRefundTracked"
      | "errorUnlinkAvoirsFirst"
      | "errorRefundedLocked"
      | "errorReturnTotalPositive"
      | "errorUnlinkReturnsFirst"
  ) => string
): ReadonlyArray<readonly [RegExp, string]> {
  return [
    [/already paid by the company/i, t("errorCompanyPaidRefundTracked")],
    [/unlink the avoirs applied/i, t("errorUnlinkAvoirsFirst")],
    [/refunded expenses are locked/i, t("errorRefundedLocked")],
    [/return's total must be zero or negative/i, t("errorReturnTotalPositive")],
    [/unlink (or delete )?this invoice's returns/i, t("errorUnlinkReturnsFirst")],
  ];
}

/**
 * The message for a failed delete or highlight: a known API refusal in the UI
 * language (see `invoiceValidationMessages`), anything else `fallback` — never
 * the API's English text.
 */
export function classifyActionError(
  err: unknown,
  validationMessages: ReadonlyArray<readonly [RegExp, string]>,
  fallback: string
): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const body = (e.data ?? e.body) as Record<string, unknown> | undefined;
    const message = body?.message;
    if (body?.error === "ValidationError" && typeof message === "string") {
      const known = validationMessages.find(([pattern]) => pattern.test(message));
      if (known) return known[1];
    }
  }
  return fallback;
}
