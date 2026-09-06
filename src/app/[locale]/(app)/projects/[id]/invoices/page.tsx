"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { canOnProject } from "@/lib/auth/project-permissions";
import { Loader2, Trash2, ChevronRight, ChevronDown, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { fetchInvoicesWithMeta, deleteInvoice } from "@/lib/api/invoice-api";
import {
  ExpensePursesSummary,
  type ExpenseSummaryMeta,
} from "@/components/invoices/expense-purses-summary";
import { BankReleaseChart } from "@/components/project/bank-release-chart";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { InvoiceMobileCard } from "@/components/invoices/invoice-mobile-card";
import { InvoiceHighlightPicker } from "@/components/invoices/invoice-highlight-picker";
import { highlightRowTint } from "@/lib/invoices/highlight-colors";
import { InvoiceExportDialog } from "@/components/invoices/invoice-export-dialog";
import { LaborInvoicesByWorker } from "@/components/invoices/labor-invoices-by-worker";
import { TransferToCompanyPaymentAction } from "@/components/invoices/transfer-to-company-payment-action";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import {
  REFUND_STATUS_STAMP,
  REFUND_STATUS_I18N,
  refundStatusI18nKey,
} from "@/lib/invoices/refundable-status-display";
import { fetchTagsClient } from "@/lib/api/tags-client";
import { groupInvoicesByMonth, monthKeyForInvoice } from "@/lib/invoices/group-invoices-by-month";
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

/** Sum of VAT amounts across all items: Σ qty × price × (vat_rate/100). */
function invoiceTva(items: Invoice["items"]): number {
  return items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
    0
  );
}

// Base column count without the TVA column.
const INVOICE_TABLE_COLUMN_COUNT_BASE = 7;
// Column count when the TVA column is shown.
const INVOICE_TABLE_COLUMN_COUNT_TVA = 8;

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp",
  labor: "stamp accent",
  materials_services: "stamp positive",
  others: "stamp muted",
  return: "stamp warning",
};

/**
 * One render section of the ledger. The "all" tab emits one section per
 * (month, category) pair — `monthKey` on every section (drives collapse),
 * `monthHeader` set only on the month's first category so the month row
 * renders once. Type tabs emit a single flat section with no header and
 * no stamp.
 */
interface TableSection {
  key: string;
  monthKey: string | null;
  monthHeader: { monthKey: string; expenseSubtotal: number; count: number } | null;
  type: InvoiceType | null;
  /** Net Σ total_amount of the category inside its month (null on flat type tabs). */
  typeSubtotal: number | null;
  items: Invoice[];
}

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
  const project = projects.find((p) => p.id === projectId) ?? null;

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
  // Collapsed month sections on the "all" tab (keys "YYYY-MM"). Default empty
  // = every month expanded; collapsing is opt-in, session-only state.
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const toggleMonth = (monthKey: string) => {
    const isCollapsing = !collapsedMonths.has(monthKey);
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
    // Collapsing the month that holds the open ?invoice= detail also closes
    // the detail — the URL never points at unmounted UI, and the deep-link
    // guard below can't re-expand a month the user just closed when a
    // refetch gives `invoices` a new identity.
    if (isCollapsing && selectedInvoiceId) {
      const selected = invoices.find((inv) => inv.id === selectedInvoiceId);
      if (selected && monthKeyForInvoice(selected) === monthKey) closeInvoice();
    }
  };
  const [summary, setSummary] = useState<{
    invoices: Invoice[];
    meta: ExpenseSummaryMeta;
  } | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // The purses summary is project-level, so it always reads an UNFILTERED
      // list; when the table itself is unfiltered a single request serves both.
      const isUnfiltered = activeTab === "all" && !tagFilter;
      const filteredPromise = fetchInvoicesWithMeta(
        projectId,
        activeTab !== "all" ? activeTab : undefined,
        tagFilter ?? undefined
      );
      const summaryPromise = isUnfiltered ? filteredPromise : fetchInvoicesWithMeta(projectId);
      const [res, sum] = await Promise.all([filteredPromise, summaryPromise]);
      setInvoices(res.invoices);
      setCompanyName(res.company_name ?? null);
      setSummary({
        invoices: sum.invoices,
        meta: {
          fundsReleasedTotal: sum.funds_released_total ?? 0,
          fundsReleasedCompanyTotal: sum.funds_released_company_total,
          fundsReleasedPersonalTotal: sum.funds_released_personal_total,
          companySpentTotal: sum.company_spent_total ?? 0,
          personalSpentTotal: sum.personal_spent_total ?? 0,
          companyCashAdvancedTotal: sum.company_cash_advanced_total ?? 0,
        },
      });
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

  // Deep-link guard: a ?invoice=<id> selection landing in a collapsed month
  // (URL paste, back button) re-expands that month so the inline detail is
  // reachable. It can't fight a user's collapse because toggleMonth clears
  // the selection when collapsing the selected invoice's month — a live
  // selection never points into a collapsed month, so refetches (which give
  // `invoices` a new identity and re-run this effect) find nothing to expand.
  useEffect(() => {
    if (!selectedInvoiceId) return;
    const selected = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!selected) return;
    const monthKey = monthKeyForInvoice(selected);
    setCollapsedMonths((prev) => {
      if (!prev.has(monthKey)) return prev;
      const next = new Set(prev);
      next.delete(monthKey);
      return next;
    });
  }, [selectedInvoiceId, invoices]);

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(projectId, invoice.id);
      await loadInvoices();
    } catch {
      setError("Failed to delete invoice");
    }
  };

  const tabs: TabType[] = ["all", "released_funds", "labor", "materials_services", "others", "return"];

  // Month → category sections for the "all" tab, computed client-side over
  // whatever the fetch returned (tag filters compose for free). Labor buckets
  // by service_month (fallback issue_date), everything else by issue_date.
  const sections: TableSection[] =
    activeTab === "all"
      ? groupInvoicesByMonth(invoices).flatMap((mg) =>
          mg.categories.map((c, idx) => ({
            key: `${mg.monthKey}-${c.type}`,
            monthKey: mg.monthKey,
            monthHeader:
              idx === 0
                ? {
                    monthKey: mg.monthKey,
                    expenseSubtotal: mg.expenseSubtotal,
                    count: mg.categories.reduce((n, cat) => n + cat.items.length, 0),
                  }
                : null,
            type: c.type,
            typeSubtotal: c.subtotal,
            items: c.items,
          }))
        )
      : [
          {
            key: "flat",
            monthKey: null,
            monthHeader: null,
            type: null,
            typeSubtotal: null,
            items: invoices,
          },
        ];

  return (
    <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
      {/* "Two purses" summary (design Expense Dataviz 1b) — project-level,
          fed by an unfiltered fetch so tab/tag filters below never change it. */}
      {summary && <ExpensePursesSummary invoices={summary.invoices} meta={summary.meta} />}

      {/* Bank draw-down — what the bank still holds of the project's credit.
          Same figures the Overview shows, so the two pages never disagree. */}
      {summary && (
        <BankReleaseChart
          credit={project?.budget}
          releasedTotal={summary.meta.fundsReleasedTotal}
          invoices={summary.invoices}
          settingsHref={`/${locale}/projects/${projectId}/settings`}
        />
      )}

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
            {activeTab === "labor" ? (
              <LaborInvoicesByWorker
                invoices={invoices}
                projectId={projectId}
                variant="mobile"
                canManage={canManageInvoices}
                companyName={companyName}
                selectedInvoiceId={selectedInvoiceId}
                onToggleInvoice={toggleInvoice}
                onCloseInvoice={closeInvoice}
                onMutated={loadInvoices}
              />
            ) : (
              sections.map(({ key, monthKey, monthHeader, type: groupType, typeSubtotal, items }) => {
                  const isCollapsed = monthKey !== null && collapsedMonths.has(monthKey);
                  return (
                  <Fragment key={key}>
                    {monthHeader && (
                      <div
                        className="flex items-baseline justify-between gap-3 pt-4"
                        data-testid={`invoices-month-header-mobile-${monthHeader.monthKey}`}
                      >
                        {/* Disclosure pattern: the h3 WRAPS the toggle button so
                            heading navigation survives (role=button children are
                            presentational — a button wrapping the h3 would eat it). */}
                        <h3>
                          <button
                            type="button"
                            onClick={() => toggleMonth(monthHeader.monthKey)}
                            aria-expanded={!isCollapsed}
                            className="label-cap -mx-2 -my-2 flex cursor-pointer items-center gap-1.5 px-2 py-2"
                            style={{ fontSize: 12, color: "var(--ink)" }}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
                            )}
                            {formatMonthYear(monthHeader.monthKey, locale)}
                          </button>
                        </h3>
                        {/* Expenses-only figure: released-funds rows sit in the
                            section below but never in this total, so the label
                            keeps it from reading as "sum of everything here". */}
                        <span className="flex items-baseline gap-1.5">
                          <span className="label-cap" style={{ fontSize: 10, color: "var(--muted)" }}>
                            {t("monthExpensesLabel")}
                          </span>
                          <span className="num text-[13px] font-medium">
                            {formatEUR(monthHeader.expenseSubtotal)}
                          </span>
                        </span>
                      </div>
                    )}
                    {!isCollapsed && groupType && (
                      <div className="flex items-center justify-between gap-2 pt-3">
                        <span className={TYPE_STAMP_CLASS[groupType]}>
                          {t(`types.${groupType}`)}
                        </span>
                        {typeSubtotal !== null && (
                          <span
                            className="num text-[12px]"
                            style={{ color: "var(--muted)" }}
                            data-testid={`invoices-type-subtotal-mobile-${monthKey}-${groupType}`}
                          >
                            {formatEUR(typeSubtotal)}
                          </span>
                        )}
                      </div>
                    )}
                    {!isCollapsed && items.map((invoice) => {
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
                  );
              })
            )}
          </div>

          {/* Desktop table. The card must NOT clip (overflow-hidden) on the
              ledger tabs: the sticky thead + month bands pin against the page
              scroll area, and any overflow ancestor between them and the
              scroller kills position:sticky. The labor tab renders its own
              nested layout with no sticky parts, so it keeps corner clipping. */}
          <div
            className={`folio-card hidden lg:block${activeTab === "labor" ? " overflow-hidden" : ""}`}
            data-testid="invoices-table-desktop"
          >
            {activeTab === "labor" ? (
              <LaborInvoicesByWorker
                invoices={invoices}
                projectId={projectId}
                variant="desktop"
                canManage={canManageInvoices}
                companyName={companyName}
                selectedInvoiceId={selectedInvoiceId}
                onToggleInvoice={toggleInvoice}
                onCloseInvoice={closeInvoice}
                onMutated={loadInvoices}
              />
            ) : (
              (() => {
                const showTvaCol = TVA_COLUMN_TABS.has(activeTab);
                const colCount = showTvaCol
                  ? INVOICE_TABLE_COLUMN_COUNT_TVA
                  : INVOICE_TABLE_COLUMN_COUNT_BASE;
                return (
                <table className="ledger ledger-sticky">
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
                      <th style={{ textAlign: "right" }}>{t("totalAmount")}</th>
                      <th style={{ textAlign: "right" }}>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map(({ key, monthKey, monthHeader, type: groupType, typeSubtotal, items }) => {
                        const isCollapsed = monthKey !== null && collapsedMonths.has(monthKey);
                        return (
                        <Fragment key={key}>
                          {monthHeader && (
                            <tr data-testid={`invoices-month-header-desktop-${monthHeader.monthKey}`}>
                              {/* Ledger band (design "Expense Table Month Style"): a full-width
                                  paper-2 strip that pins just below the sticky thead. top:36
                                  overlaps the thead's ~37px box by 1px so no sub-pixel seam of
                                  scrolled rows can bleed between the two sticky layers. */}
                              <td
                                colSpan={colCount}
                                style={{
                                  position: "sticky",
                                  top: 36,
                                  zIndex: 2,
                                  background: "var(--paper-2)",
                                  borderTop: "1px solid var(--line)",
                                  borderBottom: "1px solid var(--line)",
                                  padding: "10px 16px",
                                }}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  {/* Disclosure pattern: h3 wraps the toggle button — the
                                      heading keeps screen-reader section navigation (a
                                      button wrapping the h3 would flatten it to
                                      presentational), the button carries expand state. */}
                                  <h3>
                                    <button
                                      type="button"
                                      onClick={() => toggleMonth(monthHeader.monthKey)}
                                      aria-expanded={!isCollapsed}
                                      className="label-cap -mx-2 -my-2 flex cursor-pointer items-center gap-1.5 px-2 py-2"
                                      style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
                                    >
                                      {isCollapsed ? (
                                        <ChevronRight size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
                                      ) : (
                                        <ChevronDown size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
                                      )}
                                      {formatMonthYear(monthHeader.monthKey, locale)}
                                      <span style={{ fontWeight: 500, color: "var(--muted)" }}>
                                        · {t("monthEntries", { n: monthHeader.count })}
                                      </span>
                                    </button>
                                  </h3>
                                  {/* Expenses-only figure — see the mobile header note. */}
                                  <span className="flex items-baseline gap-1.5">
                                    <span
                                      className="label-cap"
                                      style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)" }}
                                    >
                                      {t("monthExpensesLabel")}
                                    </span>
                                    <span className="num text-[14px] font-semibold">
                                      {formatEUR(monthHeader.expenseSubtotal)}
                                    </span>
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && groupType && (
                            <tr>
                              <td
                                colSpan={colCount}
                                className="label-cap"
                                style={{
                                  paddingTop: 14,
                                  paddingBottom: 8,
                                  borderBottom: "1px solid var(--line)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={TYPE_STAMP_CLASS[groupType]}>
                                    {t(`types.${groupType}`)}
                                  </span>
                                  {typeSubtotal !== null && (
                                    <span
                                      className="num text-[12px]"
                                      style={{ color: "var(--muted)" }}
                                      data-testid={`invoices-type-subtotal-desktop-${monthKey}-${groupType}`}
                                    >
                                      {formatEUR(typeSubtotal)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && items.map((invoice) => {
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
                                  style={
                                    isOpen
                                      ? { background: "var(--paper-2)" }
                                      : highlightRowTint(invoice.highlight_color)
                                        ? { background: highlightRowTint(invoice.highlight_color) }
                                        : undefined
                                  }
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
                                    {invoice.type === "released_funds" && invoice.is_cash_advance && (
                                      <span
                                        className="stamp accent ml-2"
                                        title={t("cashAdvance.hint")}
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                        data-testid="cash-advance-badge-desktop"
                                      >
                                        {t("cashAdvance.badge")}
                                      </span>
                                    )}
                                    {/* On the month-grouped all tab a labor row can sit under a
                                        month ≠ its issue month — the service-month stamp says
                                        which month the payment is FOR (mirrors the mobile card). */}
                                    {invoice.type === "labor" && invoice.service_month && (
                                      <span
                                        className="stamp ml-2"
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                        data-testid="labor-service-month-desktop"
                                      >
                                        {formatMonthYear(invoice.service_month, locale)}
                                      </span>
                                    )}
                                    {invoice.type === "return" && (
                                      <span
                                        className="stamp warning ml-2"
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                      >
                                        {t("types.return")}
                                      </span>
                                    )}
                                    {invoice.type === "return" && invoice.settled_via === "avoir" && (
                                      <span
                                        className="stamp accent ml-2"
                                        style={{ fontSize: 10, verticalAlign: "middle" }}
                                        data-testid="avoir-badge-desktop"
                                      >
                                        {t("settledVia.avoirBadge")}
                                      </span>
                                    )}
                                    {invoice.type === "return" && invoice.refunds_invoice_number && (
                                      <span
                                        className="ml-2 text-[11px]"
                                        style={{ color: "var(--muted)" }}
                                      >
                                        {t("refundOf", { number: invoice.refunds_invoice_number })}
                                      </span>
                                    )}
                                    {invoice.type === "return" && invoice.applied_to_invoice_number && (
                                      <span
                                        className="ml-2 text-[11px]"
                                        style={{ color: "var(--muted)" }}
                                        data-testid="applied-to-label-desktop"
                                      >
                                        {t("appliedTo", { number: invoice.applied_to_invoice_number })}
                                      </span>
                                    )}
                                    {invoice.type === "return" &&
                                      invoice.settled_via === "avoir" &&
                                      !invoice.applied_to_invoice_id && (
                                        <span
                                          className="stamp ml-2"
                                          style={{ fontSize: 10, verticalAlign: "middle" }}
                                          data-testid="outstanding-avoir-stamp-desktop"
                                        >
                                          {t("settledVia.outstanding")}
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
                                          {t(
                                            refundStatusI18nKey(invoice) ??
                                              REFUND_STATUS_I18N[invoice.refundable_status]
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  {showTvaCol && (
                                    <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
                                      {tvaAmount > 0 ? formatEUR(tvaAmount) : "—"}
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
                                      {canManageInvoices && !invoice.is_auto_generated && (
                                        <InvoiceHighlightPicker
                                          invoice={invoice}
                                          onUpdated={loadInvoices}
                                        />
                                      )}
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
                        );
                    })}
                  </tbody>
                </table>
                );
              })()
            )}
          </div>
          </>
        )}
        </>
      )}
    </div>
  );
}
