"use client";

/**
 * Refundable Invoices page — company-level admin view.
 *
 * Lists materials & services expenses that are marked refundable (any status),
 * aggregated across all projects the company owns. Admins can advance/clear the
 * refundable status inline and add new refundable expenses via a picker dialog.
 *
 * Auth: inherited from billing/layout.tsx — no additional gate needed here.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchRefundableExpenses,
  type FetchRefundableExpensesParams,
} from "@/lib/api/billing/refundable-invoices";
import { useRefundableDrill } from "@/components/billing/use-refundable-drill";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { RefundableExpenseRowActions } from "@/components/billing/refundable-expense-row-actions";
import { RefundableExpenseAttachmentsCell } from "@/components/billing/refundable-expense-attachments-cell";
import { AddRefundableExpenseDialog } from "@/components/billing/add-refundable-expense-dialog";
import { RefundableSummaryCards } from "@/components/billing/refundable-summary-cards";
import { formatDate, formatEUR } from "@/lib/utils/formatters";
import { RefundSourceIndicator } from "@/components/invoices/refund-source-indicator";
import type { RefundableExpense, RefundableStatus, RefundableSummary } from "@/types/invoice";
import { useOptionalAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Company filter value for "every administered company". */
const ALL_COMPANIES = "all";

const ALL = "all";
const STATUS_FILTERS: { value: RefundableStatus; key: "refundable" | "refundPending" | "refunded" }[] = [
  { value: "refundable", key: "refundable" },
  { value: "refund_pending", key: "refundPending" },
  { value: "refunded", key: "refunded" },
];

/** The project as the rest of the app names it (name first), its address on hover. */
function projectLabel(expense: RefundableExpense): string {
  return projectDisplayName({ name: expense.project_name, address: expense.project_address });
}

/** Who refunded the expense, plus the FR number of a bank refund's funds release. */
function RefundSourceCell({
  expense,
  fundsReleaseLabel,
}: {
  expense: RefundableExpense;
  fundsReleaseLabel: (number: string) => string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RefundSourceIndicator
        refundable_status={expense.refundable_status}
        has_bank_refund={expense.has_bank_refund}
        refunded_by={expense.refunded_by}
      />
      {/* FR number of the funds release auto-created for a bank refund.
          Self-hides when no release is linked. */}
      {expense.funds_release_number && (
        <span
          className="font-mono text-xs text-muted-foreground"
          title={fundsReleaseLabel(expense.funds_release_number)}
          aria-label={fundsReleaseLabel(expense.funds_release_number)}
          data-testid="funds-release-number"
        >
          {expense.funds_release_number}
        </span>
      )}
    </span>
  );
}

export default function RefundableInvoicesPage() {
  const t = useTranslations("billing.refundable");
  const fundsReleaseLabel = (number: string) => t("fundsReleaseLabel", { number });

  const [items, setItems] = useState<RefundableExpense[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState<RefundableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Each company owes its own people: with several administered companies the
  // page can be narrowed to one, and every row names its company.
  const companies = useOptionalAuth()?.user?.companies;
  const adminCompanies = (companies ?? []).filter((c) => c.role === "admin");
  const multiCompany = adminCompanies.length > 1;
  const [companyFilter, setCompanyFilter] = useState<string>(ALL_COMPANIES);
  const companyId = companyFilter === ALL_COMPANIES ? undefined : companyFilter;
  const companyName = (expense: RefundableExpense) =>
    expense.company_name ??
    adminCompanies.find((c) => c.id === expense.company_id)?.legal_name ??
    "";
  // ?project= and ?channel= from the dashboard and expense-page drill-downs.
  const drill = useRefundableDrill();
  // Filters: search (debounced), refund status and project, sent to the API.
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  // Projects seen in any loaded page, for the project filter.
  const [knownProjects, setKnownProjects] = useState<Map<string, string>>(new Map());
  const hasFilters = search !== "" || statusFilter !== ALL || projectFilter !== ALL;
  const filterParams = useMemo<FetchRefundableExpensesParams | undefined>(() => {
    const params: FetchRefundableExpensesParams = {};
    if (search) params.q = search;
    if (statusFilter !== ALL) params.status = statusFilter as RefundableStatus;
    if (projectFilter !== ALL) params.projectId = projectFilter;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [search, statusFilter, projectFilter]);
  // Everything the API is asked for: the URL drill-down (?project=, ?channel=), the
  // filters above (a picked project wins over the URL's) and the company.
  const listParams = useMemo<FetchRefundableExpensesParams>(
    () => ({ ...drill.params, ...filterParams, companyId }),
    [drill.params, filterParams, companyId]
  );

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(id);
  }, [searchText]);

  const rememberProjects = useCallback((rows: RefundableExpense[]) => {
    setKnownProjects((prev) => {
      let next: Map<string, string> | null = null;
      for (const row of rows) {
        if (!prev.has(row.project_id)) {
          next ??= new Map(prev);
          next.set(row.project_id, projectLabel(row));
        }
      }
      return next ?? prev;
    });
  }, []);
  // Rows on screen: a reload after a status change fetches as many pages
  // again, instead of folding the list back to the first one.
  const loadedRef = useRef(0);
  const loadedFiltersKey = useRef("");

  // Keep t in a ref so the load callback can access the latest value without
  // being re-created on every render (next-intl's t is stable in production,
  // but test mocks may return a new function reference per render).
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // A new filter starts again from the first page.
      const filtersKey = JSON.stringify(listParams);
      if (loadedFiltersKey.current !== filtersKey) {
        loadedFiltersKey.current = filtersKey;
        loadedRef.current = 0;
      }
      let result = await fetchRefundableExpenses(listParams);
      let rows = result.items;
      while (rows.length < loadedRef.current && rows.length < result.total && result.items.length > 0) {
        result = await fetchRefundableExpenses({ ...listParams, offset: rows.length });
        rows = [...rows, ...result.items];
      }
      loadedRef.current = rows.length;
      rememberProjects(rows);
      setItems(rows);
      setTotal(result.total);
      setSummary(result.summary);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, [listParams, rememberProjects]);

  // Next page (the API sends at most 200 rows at a time), appended.
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchRefundableExpenses({ ...listParams, offset: items.length });
      const seen = new Set(items.map((i) => i.id));
      const next = [...items, ...result.items.filter((i) => !seen.has(i.id))];
      loadedRef.current = next.length;
      rememberProjects(result.items);
      setItems(next);
      setTotal(result.total);
      setSummary(result.summary);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={20} />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          {t("addButton")}
        </Button>
      </div>

      {multiCompany && (
        <div className="flex flex-wrap items-center gap-2" data-testid="refundable-company-filter">
          <span className="text-sm text-muted-foreground">{t("companyFilter.label")}</span>
          <Select
            value={companyFilter}
            onValueChange={(value) => {
              loadedRef.current = 0;
              setCompanyFilter(value);
            }}
          >
            <SelectTrigger className="h-8 w-auto min-w-[200px] max-w-full" aria-label={t("companyFilter.label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COMPANIES}>{t("companyFilter.all")}</SelectItem>
              {adminCompanies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <RefundableSummaryCards
        summary={summary}
        activeChannel={drill.channel}
        onSelectChannel={drill.setChannel}
      />
      {drill.chip}

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
          className="sm:w-72"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56" aria-label={t("columns.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {t(`status.${s.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {knownProjects.size > 1 || projectFilter !== ALL ? (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="sm:w-64" aria-label={t("columns.project")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allProjects")}</SelectItem>
              {[...knownProjects.entries()]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {hasFilters ? t("filters.noResults") : t("empty")}
        </div>
      ) : (
        <div>
          {/* Phones: one card per expense, its status menu next to it. */}
          <div className="space-y-2 lg:hidden" data-testid="refundable-cards">
            {items.map((expense) => (
              <div key={expense.id} className="folio-card space-y-1.5 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium" title={expense.project_name}>
                    {projectLabel(expense)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs">
                    {expense.invoice_number}
                  </span>
                </div>
                {multiCompany && (
                  <div className="truncate text-xs text-muted-foreground" data-testid="refundable-card-company">
                    {companyName(expense)}
                  </div>
                )}
                <div className="truncate">{expense.recipient_name}</div>
                {expense.payment_method_label && (
                  <div className="truncate text-xs text-muted-foreground">
                    {t("paidByLine", { payer: expense.payment_method_label })}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDate(expense.issue_date)}
                  </span>
                  <span className="tabular-nums font-medium">{formatEUR(expense.total_amount)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-2">
                    <RefundSourceCell expense={expense} fundsReleaseLabel={fundsReleaseLabel} />
                    <RefundableExpenseAttachmentsCell attachments={expense.attachments} />
                  </span>
                  <RefundableExpenseRowActions expense={expense} onReload={load} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block" data-testid="refundable-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {multiCompany && <th className="pb-2 pr-4 font-medium">{t("columns.company")}</th>}
                <th className="pb-2 pr-4 font-medium">{t("columns.project")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.invoiceNumber")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.recipient")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.paidBy")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.issueDate")}</th>
                <th className="pb-2 pr-4 font-medium text-right">{t("columns.total")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.invoice")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.refundedBy")}</th>
                <th className="pb-2 pr-4 font-medium">{t("columns.status")}</th>
                <th className="pb-2 text-right font-medium">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((expense) => (
                <tr key={expense.id} className="border-b last:border-0">
                  {multiCompany && (
                    <td className="py-3 pr-4" data-testid="refundable-row-company">
                      {companyName(expense)}
                    </td>
                  )}
                  <td className="py-3 pr-4" title={expense.project_address ?? undefined}>
                    {projectLabel(expense)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs">
                    {expense.invoice_number}
                  </td>
                  <td className="py-3 pr-4">{expense.recipient_name}</td>
                  <td className="py-3 pr-4">{expense.payment_method_label ?? "—"}</td>
                  <td className="py-3 pr-4 tabular-nums">{formatDate(expense.issue_date)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatEUR(expense.total_amount)}
                  </td>
                  <td className="py-3 pr-4">
                    <RefundableExpenseAttachmentsCell attachments={expense.attachments} />
                  </td>
                  <td className="py-3 pr-4">
                    <RefundSourceCell expense={expense} fundsReleaseLabel={fundsReleaseLabel} />
                  </td>
                  <td className="py-3 pr-4">
                    <RefundableExpenseRowActions expense={expense} onReload={load} part="status" />
                  </td>
                  <td className="py-3 text-right">
                    <RefundableExpenseRowActions expense={expense} onReload={load} part="menu" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {items.length < total && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {t("truncatedNotice", { count: items.length, total })}
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore && <Loader2 size={14} className="mr-1 animate-spin" />}
                {t("loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add refundable expense picker */}
      <AddRefundableExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={companyId}
        onAdded={() => {
          setDialogOpen(false);
          void load();
        }}
        onPartiallyAdded={() => void load()}
      />
    </div>
  );
}
