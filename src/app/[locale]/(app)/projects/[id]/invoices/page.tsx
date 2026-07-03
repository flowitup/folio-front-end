"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useLocale } from "next-intl";
import { canOnProject } from "@/lib/auth/project-permissions";
import { Loader2, Trash2, ChevronRight, ChevronDown, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { fetchInvoicesWithMeta, deleteInvoice } from "@/lib/api/invoice-api";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { InvoiceMobileCard } from "@/components/invoices/invoice-mobile-card";
import { InvoiceExportDialog } from "@/components/invoices/invoice-export-dialog";
import { TransferToCompanyPaymentAction } from "@/components/invoices/transfer-to-company-payment-action";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import { REFUND_STATUS_STAMP, REFUND_STATUS_I18N } from "@/lib/invoices/refundable-status-display";
import { fetchTagsClient } from "@/lib/api/tags-client";
import { formatDate, formatEUR, formatMonthYear } from "@/lib/utils/formatters";
import { TagFilterSelect } from "@/components/tags/tag-filter-select";
import type { ProjectTag } from "@/lib/api/tags";

type TabType = "all" | InvoiceType;

// Tabs that show a TVA column (computed from invoice items). Labor and "all" are excluded:
// labor expenses are typically time-based and VAT-exempt in construction;
// the "all" view groups multiple types and keeps a uniform layout.
const TVA_COLUMN_TABS: ReadonlySet<TabType> = new Set([
  "released_funds",
  "materials_services",
  "others",
]);

// Tabs that show the "payment for month" column — labor only, since
// service_month is exclusive to labor invoices.
const MONTH_COLUMN_TABS: ReadonlySet<TabType> = new Set(["labor"]);

/** Sum of VAT amounts across all items: Σ qty × price × (vat_rate/100). */
function invoiceTva(items: Invoice["items"]): number {
  return items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
    0
  );
}

// Base column count without TVA/Month columns.
const INVOICE_TABLE_COLUMN_COUNT_BASE = 7;
// Column count when the TVA column is shown.
const INVOICE_TABLE_COLUMN_COUNT_TVA = 8;
// Column count when the Month column is shown (mutually exclusive with TVA).
const INVOICE_TABLE_COLUMN_COUNT_MONTH = 8;

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp",
  labor: "stamp accent",
  materials_services: "stamp positive",
  others: "stamp muted",
  refund: "stamp warning",
};

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { projects } = useProject();

  // The selected invoice id lives in `?invoice=<id>` so the modal is deep-linkable
  const selectedInvoiceId = searchParams.get("invoice");

  /**
   * URL strategy: use push() for the initial open (none → some) so the back
   * button closes the inline panel, matching modal-style expectations. Use
   * replace() for swaps and close to avoid history pollution from rapid toggling.
   */
  const setSelected = (next: string | null, isInitialOpen: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("invoice", next);
    else params.delete("invoice");
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (isInitialOpen) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  /** Toggle: clicking the open row collapses it; clicking another swaps. */
  const toggleInvoice = (id: string) => {
    if (selectedInvoiceId === id) {
      setSelected(null, false);
    } else {
      // First-time open (no previous selection) gets a history entry; swap doesn't.
      setSelected(id, selectedInvoiceId === null);
    }
  };

  const closeInvoice = () => setSelected(null, false);

  // Effective per-project permissions (global role UNION this project's
  // membership-role perms) — not just the global JWT permissions.
  const projectPerms = projects.find((p) => p.id === projectId)?.my_permissions;
  const canManageInvoices = canOnProject("project:manage_invoices", user?.permissions, projectPerms);

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fundsReleasedTotal, setFundsReleasedTotal] = useState(0);
  const [companySpentTotal, setCompanySpentTotal] = useState(0);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchInvoicesWithMeta(
        projectId,
        activeTab !== "all" ? activeTab : undefined,
        tagFilter ?? undefined
      );
      setInvoices(res.invoices);
      setFundsReleasedTotal(res.funds_released_total);
      setCompanySpentTotal(res.company_spent_total ?? 0);
      setCompanyName(res.company_name ?? null);
    } catch {
      setError("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, activeTab, tagFilter]);

  // Load tags once for filter dropdown (non-fatal).
  useEffect(() => {
    fetchTagsClient(projectId)
      .then(setTags)
      .catch(() => setTags([]));
  }, [projectId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(projectId, invoice.id);
      await loadInvoices();
    } catch {
      setError("Failed to delete invoice");
    }
  };

  const tabs: TabType[] = ["all", "released_funds", "labor", "materials_services", "others", "refund"];

  const GROUP_ORDER: InvoiceType[] = ["released_funds", "labor", "materials_services", "others", "refund"];
  const groupedInvoices = GROUP_ORDER
    .map((type) => ({ type, items: invoices.filter((i) => i.type === type) }))
    .filter((g) => g.items.length > 0);
  const showGroups = activeTab === "all" && groupedInvoices.length > 0;

  // Compute KPIs from current invoice list. KPI cards round to whole
  // euros; row totals use the shared 2-decimal formatEUR.
  const formatEURWhole = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  // Total expenses intentionally excludes released_funds auto-invoices —
  // those represent capital flows, not project expenses.
  const expenseInvoices = invoices.filter((i) => i.type !== "released_funds");
  const totalInvoiced = expenseInvoices.reduce((s, i) => s + i.total_amount, 0);
  const releasedFundsInvoices = invoices.filter((i) => i.type === "released_funds");
  const laborInvoices = invoices.filter((i) => i.type === "labor");
  const materialsInvoices = invoices.filter((i) => i.type === "materials_services");
  const othersInvoices = invoices.filter((i) => i.type === "others");
  const refundInvoices = invoices.filter((i) => i.type === "refund");

  return (
    <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
      {/* KPI Row — on mobile the headline total spans full width as a hero and
          the type breakdowns tuck into a compact 2-up grid beneath it, so the
          summary reads as one primary figure + supporting detail instead of a
          tall stack of equal-weight cards. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
        <div className="folio-card col-span-2 p-5 lg:col-span-1">
          <div className="label-cap">{t("totalInvoiced")}</div>
          <div
            className={`font-display num mt-2 text-[28px] font-medium leading-none${totalInvoiced < 0 ? " text-destructive" : ""}`}
          >
            {formatEURWhole(totalInvoiced)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: expenseInvoices.length })}
          </div>
        </div>
        {/* Funds-released amounts are project-level meta (unfiltered), so the
            card only renders on tabs where released-funds invoices are in the
            list — on other tabs its filtered count would contradict the
            global amounts ("97 376 € … no expenses"). */}
        {(activeTab === "all" || activeTab === "released_funds") && (
          <div className="folio-card p-4 lg:p-5">
            <div className="label-cap">{t("fundsReleased")}</div>
            <div
              className="font-display num mt-2 text-[22px] font-medium leading-none"
              style={{ color: "var(--positive)" }}
            >
              {formatEURWhole(companySpentTotal)}
              <span className="text-[16px]"> / </span>
              {formatEURWhole(fundsReleasedTotal)}
            </div>
            <div className="num mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
              {t("refund.companySpentOfReleased")}
            </div>
            <div className="num mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
              {t("invoiceCount", { n: releasedFundsInvoices.length })}
            </div>
          </div>
        )}
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("types.labor")}</div>
          <div
            className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]"
            style={{ color: "var(--accent)" }}
          >
            {formatEURWhole(laborInvoices.reduce((s, i) => s + i.total_amount, 0))}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: laborInvoices.length })}
          </div>
        </div>
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("types.materials_services")}</div>
          <div
            className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]"
          >
            {formatEURWhole(materialsInvoices.reduce((s, i) => s + i.total_amount, 0))}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: materialsInvoices.length })}
          </div>
        </div>
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("types.others")}</div>
          <div
            className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]"
            style={{ color: "var(--muted)" }}
          >
            {formatEURWhole(othersInvoices.reduce((s, i) => s + i.total_amount, 0))}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: othersInvoices.length })}
          </div>
        </div>
        {refundInvoices.length > 0 && (
          <div className="folio-card p-4 lg:p-5">
            <div className="label-cap">{t("types.refund")}</div>
            <div
              className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px] text-destructive"
            >
              {formatEURWhole(refundInvoices.reduce((s, i) => s + i.total_amount, 0))}
            </div>
            <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
              {t("invoiceCount", { n: refundInvoices.length })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="seg">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "on" : ""}
            >
              {tab === "all" ? t("all") : t(`types.${tab}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tags.length > 0 && (
            <TagFilterSelect
              tags={tags}
              value={tagFilter}
              onChange={setTagFilter}
            />
          )}
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            {t("export.trigger")}
          </Button>
        </div>
      </div>

      <InvoiceExportDialog
        projectId={projectId}
        open={exportOpen}
        onOpenChange={setExportOpen}
        initialType={activeTab}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {!isLoading && (
        <>
        {invoices.length === 0 ? (
          <div className="folio-card overflow-hidden">
            <div
              className="flex items-center justify-center py-12 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("noInvoices")}
            </div>
          </div>
        ) : (
          <>
          {/* Mobile card list */}
          <div className="space-y-3 lg:hidden">
            {(showGroups ? groupedInvoices : [{ type: null, items: invoices }]).map(
              ({ type: groupType, items }) => (
                <Fragment key={groupType ?? "flat"}>
                  {groupType && (
                    <div className="flex items-center gap-2 pt-3">
                      <span className={TYPE_STAMP_CLASS[groupType]}>
                        {t(`types.${groupType}`)}
                      </span>
                    </div>
                  )}
                  {items.map((invoice) => {
                    const isOpen = selectedInvoiceId === invoice.id;
                    return (
                      <InvoiceMobileCard
                        key={invoice.id}
                        invoice={invoice}
                        isOpen={isOpen}
                        onToggle={() => toggleInvoice(invoice.id)}
                        formatAmount={formatEUR}
                        companyName={companyName}
                      >
                        <InvoiceDetailRow
                          projectId={projectId}
                          invoiceId={invoice.id}
                          canManage={canManageInvoices}
                          colSpan={1}
                          regionId={`invoice-detail-mobile-${invoice.id}`}
                          onMutated={loadInvoices}
                          onCollapse={closeInvoice}
                          companyName={companyName}
                          asCard
                        />
                      </InvoiceMobileCard>
                    );
                  })}
                </Fragment>
              )
            )}
          </div>

          {/* Desktop table */}
          <div className="folio-card hidden overflow-hidden lg:block" data-testid="invoices-table-desktop">
            <div className="overflow-x-auto">
              {(() => {
                const showTvaCol = TVA_COLUMN_TABS.has(activeTab);
                const showMonthCol = MONTH_COLUMN_TABS.has(activeTab);
                const colCount = showTvaCol
                  ? INVOICE_TABLE_COLUMN_COUNT_TVA
                  : showMonthCol
                    ? INVOICE_TABLE_COLUMN_COUNT_MONTH
                    : INVOICE_TABLE_COLUMN_COUNT_BASE;
                return (
                <table className="ledger">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>{t("invoiceNumber")}</th>
                      <th>{t("issueDate")}</th>
                      <th>{t("recipient")}</th>
                      <th>{t("paymentMethod.label")}</th>
                      {showTvaCol && (
                        <th style={{ textAlign: "right" }}>{t("colTva")}</th>
                      )}
                      {showMonthCol && <th>{t("serviceMonth")}</th>}
                      <th style={{ textAlign: "right" }}>{t("totalAmount")}</th>
                      <th style={{ textAlign: "right" }}>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showGroups ? groupedInvoices : [{ type: null, items: invoices }]).map(
                      ({ type: groupType, items }) => (
                        <Fragment key={groupType ?? "flat"}>
                          {groupType && (
                            <tr>
                              <td
                                colSpan={colCount}
                                className="label-cap"
                                style={{
                                  paddingTop: 20,
                                  paddingBottom: 8,
                                  borderBottom: "1px solid var(--line)",
                                }}
                              >
                                <span className={TYPE_STAMP_CLASS[groupType]}>
                                  {t(`types.${groupType}`)}
                                </span>
                              </td>
                            </tr>
                          )}
                          {items.map((invoice) => {
                            const isOpen = selectedInvoiceId === invoice.id;
                            const detailId = `invoice-detail-${invoice.id}`;
                            const tvaAmount = showTvaCol ? invoiceTva(invoice.items) : 0;
                            return (
                              <Fragment key={invoice.id}>
                                <tr
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isOpen}
                                  aria-controls={detailId}
                                  className="cursor-pointer"
                                  style={isOpen ? { background: "var(--paper-2)" } : undefined}
                                  onClick={() => toggleInvoice(invoice.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      toggleInvoice(invoice.id);
                                    }
                                  }}
                                >
                                  <td style={{ color: "var(--muted)" }}>
                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </td>
                                  <td className="num text-[12.5px]">
                                    {invoice.invoice_number}
                                    {invoice.is_auto_generated && (
                                      <span
                                        className="stamp ml-2"
                                        title={t("autoGenerated")}
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                      >
                                        <Lock size={10} className="mr-0.5 inline" />
                                        {t("auto")}
                                      </span>
                                    )}
                                    {invoice.type === "refund" && (
                                      <span
                                        className="stamp warning ml-2"
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                      >
                                        {t("types.refund")}
                                      </span>
                                    )}
                                    {invoice.type === "refund" && invoice.refunds_invoice_number && (
                                      <span
                                        className="ml-2 text-[11px]"
                                        style={{ color: "var(--muted)" }}
                                      >
                                        {t("refundOf", { number: invoice.refunds_invoice_number })}
                                      </span>
                                    )}
                                  </td>
                                  <td className="num" style={{ color: "var(--muted)" }}>
                                    {formatDate(invoice.issue_date)}
                                  </td>
                                  <td>{invoice.recipient_name}</td>
                                  <td>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {invoice.refundable_status != null && companyName ? (
                                        <span className="stamp truncate max-w-[180px]">
                                          {invoice.payment_method_label?.trim()
                                            ? `${localizeMethodLabel(invoice.payment_method_label, tBuiltins)} → ${companyName}`
                                            : `→ ${companyName}`}
                                        </span>
                                      ) : invoice.payment_method_label?.trim() ? (
                                        <span className="stamp">
                                          {localizeMethodLabel(invoice.payment_method_label, tBuiltins)}
                                        </span>
                                      ) : (
                                        <span style={{ color: "var(--muted)" }}>—</span>
                                      )}
                                      {invoice.refundable_status != null && (
                                        <span className={REFUND_STATUS_STAMP[invoice.refundable_status]}>
                                          {t(REFUND_STATUS_I18N[invoice.refundable_status])}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  {showTvaCol && (
                                    <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                                      {tvaAmount > 0 ? formatEUR(tvaAmount) : "—"}
                                    </td>
                                  )}
                                  {showMonthCol && (
                                    <td style={{ color: "var(--muted)" }}>
                                      {invoice.service_month
                                        ? formatMonthYear(invoice.service_month, locale)
                                        : "—"}
                                    </td>
                                  )}
                                  <td
                                    className={`num font-medium${invoice.total_amount < 0 ? " text-destructive" : ""}`}
                                    style={{ textAlign: "right" }}
                                  >
                                    {formatEUR(invoice.total_amount)}
                                  </td>
                                  <td
                                    style={{ textAlign: "right" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      {canManageInvoices &&
                                        invoice.type === "materials_services" &&
                                        invoice.refundable_status == null &&
                                        !invoice.paid_by_company && (
                                          <TransferToCompanyPaymentAction
                                            invoiceId={invoice.id}
                                            onSuccess={loadInvoices}
                                          />
                                        )}
                                      {canManageInvoices && !invoice.is_auto_generated && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          style={{ color: "var(--muted)" }}
                                          onClick={() => handleDelete(invoice)}
                                        >
                                          <Trash2 size={13} />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {isOpen && (
                                  <InvoiceDetailRow
                                    projectId={projectId}
                                    invoiceId={invoice.id}
                                    canManage={canManageInvoices}
                                    colSpan={colCount}
                                    regionId={detailId}
                                    onMutated={loadInvoices}
                                    onCollapse={closeInvoice}
                                    companyName={companyName}
                                  />
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      )
                    )}
                  </tbody>
                </table>
                );
              })()}
            </div>
          </div>
          </>
        )}
        </>
      )}
    </div>
  );
}
