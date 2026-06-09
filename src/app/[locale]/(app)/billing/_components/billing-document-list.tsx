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
 *   - Search input (debounced 300ms, client-side filter on current page)
 *   - Table: Number / Date / Recipient / Status badge / Total TTC / Actions menu
 *   - Load-more pagination (25 per page) via router.push ?page= round-trip
 *   - Empty state with "Create your first {kind}" CTA
 */

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Loader2, FileText } from "lucide-react";
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
import type { BillingDocument, BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";
import { kindToSegment } from "@/lib/billing/url-helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVIS_STATUSES: BillingDocumentStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
];

const FACTURE_STATUSES: BillingDocumentStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

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
}

export function BillingDocumentList({
  kind,
  initialDocuments,
  initialTotal,
}: BillingDocumentListProps) {
  const t = useTranslations("billing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();

  // Status filter — read directly from ?status= per render (H-2: no local useState).
  // handleStatusChange calls router.push which triggers a server re-render with
  // new searchParams, keeping URL as the single source of truth for the filter.
  const statusFilter = (searchParams.get("status") as BillingDocumentStatus | null) ?? "all";

  // Search — client-side filter on current page
  const [searchRaw, setSearchRaw] = useState(searchParams.get("q") ?? "");
  const [search, setSearch] = useState(searchRaw);

  // Debounce search
  const [, startTransition] = useTransition();
  const handleSearchChange = useCallback((value: string) => {
    setSearchRaw(value);
    startTransition(() => setSearch(value));
  }, []);

  // Load-more state — navigation-based; server page re-renders with new props.
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Current page — driven from ?page= param
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));
  // hasMore: server accumulates pages (limit = PAGE_SIZE * page), so once
  // initialDocuments.length equals initialTotal we've loaded everything.
  const hasMore = initialDocuments.length < initialTotal;

  // Client-side filter (search over current loaded page — initialDocuments from server)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialDocuments;
    return initialDocuments.filter(
      (d) =>
        d.document_number.toLowerCase().includes(q) ||
        d.recipient_name.toLowerCase().includes(q)
    );
  }, [initialDocuments, search]);

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

  async function handleLoadMore() {
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(nextPage));
      // Navigate — server component will re-fetch and pass new initialDocuments.
      // For a SPA-feel we append client-side after server data arrives via router.
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      setLoadError("Failed to load more documents. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
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

  const statusOptions = kind === "devis" ? DEVIS_STATUSES : FACTURE_STATUSES;
  const kindLabel = t(`${kind}.list.title`);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (initialTotal === 0 && statusFilter === "all" && !search.trim()) {
    return (
      <div className="fade-up space-y-6 px-8 pb-12">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-medium">
            {t(`${kind}.list.title`)}
          </h1>
          <Button onClick={() => router.push(newPath)}>
            <Plus size={14} className="mr-2" />
            {t(`${kind}.list.new`)}
          </Button>
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
    );
  }

  // ---------------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------------

  return (
    <div className="fade-up space-y-6 px-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-medium">
          {t(`${kind}.list.title`)}
        </h1>
        <Button onClick={() => router.push(newPath)}>
          <Plus size={14} className="mr-2" />
          {t(`${kind}.list.new`)}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder={t("list.searchPlaceholder")}
          value={searchRaw}
          onChange={(e) => handleSearchChange(e.target.value)}
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

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Mobile card list */}
      {filtered.length === 0 ? (
        <div
          className="folio-card flex items-center justify-center py-12 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          {t("list.noResults")}
        </div>
      ) : (
        <>
          {/* Mobile cards — hidden on desktop */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((doc) => (
              <div key={doc.id} className="folio-card p-4">
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
                      {doc.issue_date}
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
                    <tr key={doc.id}>
                      <td className="num text-[12.5px] font-medium">
                        {doc.document_number}
                      </td>
                      <td className="num" style={{ color: "var(--muted)" }}>
                        {doc.issue_date}
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
      {hasMore && filtered.length > 0 && (
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
  );
}
