"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { canOnProject } from "@/lib/auth/project-permissions";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import {
  ExpensePursesSummary,
  type ExpenseSummaryMeta,
} from "@/components/invoices/expense-purses-summary";
import { ExpenseCommandBar, type ExpenseChip } from "@/components/invoices/expense-command-bar";
import { ExpenseGroupedList } from "@/components/invoices/expense-grouped-list";
import { ExpenseDetailDrawer } from "@/components/invoices/expense-detail-drawer";
import { ExpenseSplitView } from "@/components/invoices/expense-split-view";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { InvoiceMobileCard } from "@/components/invoices/invoice-mobile-card";
import { InvoiceExportDialog } from "@/components/invoices/invoice-export-dialog";
import { groupByTimeline, groupByCategory } from "@/lib/invoices/expense-grouping";
import { fetchTagsClient } from "@/lib/api/tags-client";
import { formatEUR } from "@/lib/utils/formatters";
import { TagFilterSelect } from "@/components/tags/tag-filter-select";
import type { ProjectTag } from "@/lib/api/tags";
import {
  matchesQuery,
  inMonthRange,
  chipCounts,
  type ExpenseTabType,
} from "@/lib/invoices/expense-filters";

type TabType = ExpenseTabType;

type ViewVariant = "timeline" | "category" | "split";
const VIEW_VARIANTS: readonly ViewVariant[] = ["timeline", "category", "split"];
const VIEW_STORAGE_KEY = "folio.expense.view";

function isViewVariant(value: string | null): value is ViewVariant {
  return value !== null && (VIEW_VARIANTS as readonly string[]).includes(value);
}

// Type → stamp hue for the grouped desktop list (timeline/category views).
// Mobile card + other pages keep their own separate mapping (see
// invoice-mobile-card.tsx) — do not repoint them at this one.
const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp sage",
  labor: "stamp accent",
  materials_services: "stamp olive",
  others: "stamp ochre",
  return: "stamp amber",
};

export default function InvoicesPage() {
  const t = useTranslations("invoices");
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
  const [summary, setSummary] = useState<{
    invoices: Invoice[];
    meta: ExpenseSummaryMeta;
  } | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // View variant — persisted to localStorage, read lazily in an effect so the
  // initial (SSR-matching) render always uses the "timeline" default.
  const [variant, setVariant] = useState<ViewVariant>("timeline");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (isViewVariant(stored)) setVariant(stored);
    } catch {
      // localStorage unavailable (private browsing, etc.) — keep the default.
    }
  }, []);
  const changeVariant = (next: ViewVariant) => {
    setVariant(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Best-effort persistence only.
    }
  };

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Single unfiltered fetch feeds both the purses summary (always
      // project-level) and the table/cards below — type/tag/search/range
      // filtering all happen client-side (see expense-filters.ts).
      const res = await fetchInvoicesWithMeta(projectId);
      setInvoices(res.invoices);
      setCompanyName(res.company_name ?? null);
      setSummary({
        invoices: res.invoices,
        meta: {
          fundsReleasedTotal: res.funds_released_total ?? 0,
          fundsReleasedCompanyTotal: res.funds_released_company_total,
          fundsReleasedPersonalTotal: res.funds_released_personal_total,
          companySpentTotal: res.company_spent_total ?? 0,
          personalSpentTotal: res.personal_spent_total ?? 0,
        },
      });
    } catch {
      setError("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load tags once for filter dropdown (non-fatal).
  useEffect(() => {
    fetchTagsClient(projectId)
      .then(setTags)
      .catch(() => setTags([]));
  }, [projectId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const tabs: TabType[] = ["all", "released_funds", "labor", "materials_services", "others", "return"];

  // Search + range filtering only — chip counts are computed from this list
  // so switching the type chip never changes the numbers shown on the others.
  const searchRangeFiltered = useMemo(
    () => invoices.filter((inv) => matchesQuery(inv, q) && inMonthRange(inv, from, to)),
    [invoices, q, from, to]
  );
  const counts = useMemo(() => chipCounts(searchRangeFiltered), [searchRangeFiltered]);
  const chips: ExpenseChip[] = tabs.map((tab) => ({
    key: tab,
    label: tab === "all" ? t("all") : t(`types.${tab}`),
    count: counts[tab],
    active: activeTab === tab,
  }));

  // Full pipeline (type + tag on top of search/range) — what the table/cards render.
  const filteredInvoices = useMemo(
    () =>
      searchRangeFiltered.filter((inv) => {
        if (activeTab !== "all" && inv.type !== activeTab) return false;
        if (tagFilter && inv.tag_id !== tagFilter) return false;
        return true;
      }),
    [searchRangeFiltered, activeTab, tagFilter]
  );

  const GROUP_ORDER: InvoiceType[] = ["released_funds", "labor", "materials_services", "others", "return"];
  const groupedInvoices = GROUP_ORDER
    .map((type) => ({ type, items: filteredInvoices.filter((i) => i.type === type) }))
    .filter((g) => g.items.length > 0);
  const showGroups = activeTab === "all" && groupedInvoices.length > 0;

  // Desktop grouped list (timeline/category variants only — "split" renders
  // its own flat master-detail layout via ExpenseSplitView instead).
  const desktopSections = useMemo(
    () =>
      variant === "category"
        ? groupByCategory(filteredInvoices, t)
        : groupByTimeline(filteredInvoices, locale),
    [variant, filteredInvoices, t, locale]
  );

  // Drawer target — looked up in the full (unfiltered) list so a deep link
  // still resolves even if the current type/tag/search filters would hide
  // the row from the desktop list.
  const selectedInvoice = selectedInvoiceId
    ? (invoices.find((inv) => inv.id === selectedInvoiceId) ?? null)
    : null;

  return (
    <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
      {/* "Two purses" summary (design Expense Dataviz 1b) — project-level,
          fed by an unfiltered fetch so filters below never change it. Month
          bars jump the command-bar range to that month. */}
      {summary && (
        <ExpensePursesSummary
          invoices={summary.invoices}
          meta={summary.meta}
          onMonthClick={(key) => {
            setFrom(key);
            setTo(key);
          }}
        />
      )}

      {/* Creation lives in the Topbar's "New expense" action — no duplicate here. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg">
          {VIEW_VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeVariant(v)}
              className={variant === v ? "on" : ""}
            >
              {t(`views.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <ExpenseCommandBar
        q={q}
        onQChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        clearSearchLabel={t("clearSearch")}
        chips={chips}
        onChipSelect={setActiveTab}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onClearRange={() => {
          setFrom("");
          setTo("");
        }}
        fromLabel={t("dateRange.from")}
        toLabel={t("dateRange.to")}
        clearRangeLabel={t("dateRange.clear")}
      >
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
      </ExpenseCommandBar>

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
        ) : filteredInvoices.length === 0 ? (
          <div className="folio-card overflow-hidden">
            <div
              className="flex items-center justify-center py-12 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("grouped.emptyFiltered")}
            </div>
          </div>
        ) : (
          <>
          {/* Mobile card list */}
          <div className="space-y-3 lg:hidden">
            {(showGroups ? groupedInvoices : [{ type: null, items: filteredInvoices }]).map(
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

          {/* Desktop: grouped list (timeline year→month / category sections)
              or the split master-detail view — mutually exclusive by variant. */}
          {variant === "split" ? (
            <ExpenseSplitView
              invoices={filteredInvoices}
              projectId={projectId}
              canManageInvoices={canManageInvoices}
              companyName={companyName}
              onMutated={loadInvoices}
            />
          ) : (
            <ExpenseGroupedList
              variant={variant === "category" ? "category" : "timeline"}
              sections={desktopSections}
              selectedInvoiceId={selectedInvoiceId}
              onToggle={toggleInvoice}
              companyName={companyName}
              typeStampClass={TYPE_STAMP_CLASS}
            />
          )}
          </>
        )}
        </>
      )}

      {/* Detail drawer — timeline/category only; split shows detail inline. */}
      {variant !== "split" && (
        <ExpenseDetailDrawer
          invoice={selectedInvoice}
          projectId={projectId}
          canManageInvoices={canManageInvoices}
          companyName={companyName}
          typeStampClass={TYPE_STAMP_CLASS}
          onMutated={loadInvoices}
          onClose={closeInvoice}
        />
      )}
    </div>
  );
}
