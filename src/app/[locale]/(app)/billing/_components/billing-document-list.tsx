"use client";

/**
 * BillingDocumentList — shared client component for Devis and Factures list pages.
 *
 * Props:
 *   kind             — "devis" | "facture" — controls labels, status filter options, CTA text.
 *   initialDocuments — server-fetched first page (25 items), avoids client re-fetch on mount.
 *   initialTotal     — total count from the server for pagination display.
 *
 * Features:
 *   - Status filter Select (kind-aware values)
 *   - Search input (debounced 300ms, sent to the API as ?q= so every
 *     document is searched, not only the loaded ones)
 *   - Table: Number / Date / Recipient / Status badge / Total TTC / Actions menu;
 *     a row opens its document
 *   - Load-more pagination (25 per page) via router.push ?page= round-trip
 *   - Empty state with "Create your first {kind}" CTA
 *   - Import of historical documents (CSV / JSON) for the companies the caller
 *     may issue from; hidden when there is none
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Loader2, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { BillingActionsMenu } from "@/components/billing/billing-actions-menu";
import { BillingImportDialog } from "@/components/billing/billing-import-dialog";
import type { BillingDocument, BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";
import type { MyCompany } from "@/types/companies";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { formatDate } from "@/lib/utils/formatters";
import { toIsoDate } from "@/lib/billing/document-payload";
import { parsePage, parseQuery, parseStatus, statusesFor } from "./billing-list-params";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;

// STATUS_LABEL removed — status labels now come from i18n via t(`${kind}.status.${s}`).

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTTC(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BillingDocumentListProps {
  kind: BillingDocumentKind;
  initialDocuments: BillingDocument[];
  initialTotal: number;
  /** Companies the caller may issue documents for; the import action needs one. */
  issuerCompanies?: MyCompany[];
  /** The server could not load the list: show an error, not "no documents yet". */
  loadError?: boolean;
}

export function BillingDocumentList({
  kind,
  initialDocuments,
  initialTotal,
  issuerCompanies = [],
  loadError: listLoadError = false,
}: BillingDocumentListProps) {
  const t = useTranslations("billing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();

  // Status filter — read directly from ?status= per render (H-2: no local useState).
  // handleStatusChange calls router.push which triggers a server re-render with
  // new searchParams, keeping URL as the single source of truth for the filter.
  // An unknown ?status= is ignored (the server page does the same).
  const statusFilter = parseStatus(kind, searchParams.get("status")) ?? "all";

  // Search — applied by the API through ?q=, so older documents are found too.
  const search = parseQuery(searchParams.get("q"));
  const [searchRaw, setSearchRaw] = useState(search);

  // Debounce: push the typed text to the URL once typing pauses.
  useEffect(() => {
    const next = parseQuery(searchRaw);
    if (next === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page"); // a new search starts from the first page
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchRaw, search, searchParams, pathname, router]);

  // Load-more state — navigation-based; server page re-renders with new props.
  // The navigation runs in a transition, so isLoadingMore stays true until the
  // next page is rendered (a failed load comes back as the loadError prop).
  const [isLoadingMore, startLoadMore] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  // Current page — driven from ?page= param
  const currentPage = parsePage(searchParams.get("page"));
  // hasMore: server accumulates pages (limit = PAGE_SIZE * page), so once
  // initialDocuments.length equals initialTotal we've loaded everything.
  const hasMore = initialDocuments.length < initialTotal;

  const filtered = initialDocuments;

  const documentPath = (doc: BillingDocument) =>
    `/${locale}/billing/${kindToSegment(kind)}/${doc.id}`;

  // A row opens its document; the actions cell stops the click itself.
  const rowLinkProps = (doc: BillingDocument) => ({
    role: "link" as const,
    tabIndex: 0,
    "aria-label": doc.document_number,
    className: "cursor-pointer",
    onClick: () => router.push(documentPath(doc)),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.target === e.currentTarget) router.push(documentPath(doc));
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleStatusChange(value: string) {
    const next = value as BillingDocumentStatus | "all";
    // Round-trip: server page re-fetches with new status filter
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    params.delete("page"); // reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleLoadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(currentPage + 1));
    // Navigate — server component will re-fetch and pass new initialDocuments.
    startLoadMore(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleMutated() {
    // After delete/convert the server page re-renders from router invalidation.
    router.refresh();
  }

  // Sync documents when initialDocuments prop changes (after router navigation)
  // This is handled naturally by Next.js since server re-renders pass new props
  // but we explicitly reset state to avoid stale data across page transitions.
  // Note: React Server Components re-render the server page; the client component
  // receives new props from above. useState initializer doesn't re-run — so we
  // track via a stable key pattern at the page level instead.

  const newPath = `/${locale}/billing/${kindToSegment(kind)}/new`;

  const statusOptions = statusesFor(kind);
  const canImport = issuerCompanies.length > 0;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canImport && (
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload size={14} className="mr-2" />
          {t("import.button")}
        </Button>
      )}
      <Button onClick={() => router.push(newPath)}>
        <Plus size={14} className="mr-2" />
        {t(`${kind}.list.new`)}
      </Button>
    </div>
  );

  const importDialog = canImport ? (
    <BillingImportDialog
      kind={kind}
      open={importOpen}
      onOpenChange={setImportOpen}
      companies={issuerCompanies}
      onImported={handleMutated}
    />
  ) : null;

  const kindLabel = t(`${kind}.list.title`);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  // Both views return [page, importDialog] so the dialog keeps its state (and
  // its summary) when a first import turns the empty state into the list.
  const narrowed = statusFilter !== "all" || search !== "" || searchParams.has("project_id");
  if (!listLoadError && initialTotal === 0 && !narrowed) {
    return (
      <>
        <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-xl font-medium">
              {t(`${kind}.list.heading`)}
            </h1>
            {headerActions}
          </div>
          <div className="folio-card flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--paper-2)" }}
            >
              <FileText size={22} style={{ color: "var(--muted)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {t(`${kind}.list.empty.title`)}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                {t(`${kind}.list.empty.description`)}
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push(newPath)}>
              <Plus size={14} className="mr-2" />
              {t(`${kind}.list.empty.cta`)}
            </Button>
          </div>
        </div>
        {importDialog}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl font-medium">
            {t(`${kind}.list.heading`)}
          </h1>
          {headerActions}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder={t("list.searchPlaceholder")}
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            maxLength={100}
            className="sm:w-64"
          />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder={t("list.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("list.allStatuses")}</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`${kind}.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {listLoadError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("list.loadFailed")}</span>
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                {t("list.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <div
            className="folio-card flex items-center justify-center py-12 text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            {search ? t("list.noResults") : t("list.noFilterResults")}
          </div>
        ) : (
          <>
            {/* Mobile cards — hidden on desktop */}
            <div className="space-y-2 lg:hidden">
              {filtered.map((doc) => (
                <div key={doc.id} {...rowLinkProps(doc)} className="folio-card cursor-pointer p-4">
                  {/* Row 1: document number + status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[12.5px] font-medium">
                      {doc.document_number}
                    </span>
                    <BillingStatusBadge
                      status={doc.status}
                      label={t(`${kind}.status.${doc.status}`)}
                    />
                  </div>
                  {/* Row 2: recipient */}
                  <div className="mt-1.5 text-[13px]">{doc.recipient_name}</div>
                  {/* Row 3: date + total + actions */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="num text-[12px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {formatDate(toIsoDate(doc.issue_date) ?? doc.issue_date)}
                      </span>
                      <span className="num text-[13px] font-medium">
                        {formatTTC(doc.total_ttc)}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <BillingActionsMenu
                        document={doc}
                        onMutated={handleMutated}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table — hidden on mobile */}
            <div className="folio-card hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>{t("list.columns.number")}</th>
                      <th>{t("list.columns.date")}</th>
                      <th>{t("list.columns.recipient")}</th>
                      <th>{t("list.columns.status")}</th>
                      <th style={{ textAlign: "right" }}>{t("list.columns.totalTtc")}</th>
                      <th style={{ textAlign: "right" }}>{t("list.columns.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc) => (
                      <tr key={doc.id} {...rowLinkProps(doc)}>
                        <td className="num text-[12.5px] font-medium">
                          {doc.document_number}
                        </td>
                        <td className="num" style={{ color: "var(--muted)" }}>
                          {formatDate(toIsoDate(doc.issue_date) ?? doc.issue_date)}
                        </td>
                        <td>{doc.recipient_name}</td>
                        <td>
                          <BillingStatusBadge
                            status={doc.status}
                            label={t(`${kind}.status.${doc.status}`)}
                          />
                        </td>
                        <td className="num font-medium" style={{ textAlign: "right" }}>
                          {formatTTC(doc.total_ttc)}
                        </td>
                        <td
                          style={{ textAlign: "right" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BillingActionsMenu
                            document={doc}
                            onMutated={handleMutated}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Pagination — load more */}
        {hasMore && !listLoadError && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : null}
              {t("list.loadMore", { kindLabel })}
            </Button>
          </div>
        )}
      </div>
      {importDialog}
    </>
  );
}
