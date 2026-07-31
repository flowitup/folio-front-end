"use client";

/**
 * "Split" master-detail expense view (design Expense redesign — phase 03).
 * Desktop-only (lg+) — below `lg` the page falls back to the mobile card
 * list, same as the timeline/category variants.
 *
 * Selection is LOCAL state (never written to `?invoice=`) so clicking rows
 * stays instant and doesn't pollute history. If the page mounted with
 * `?invoice=<id>` already set (e.g. a link shared while on another variant),
 * that id seeds the initial selection once, then the param is stripped.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import { formatDate, formatEUR } from "@/lib/utils/formatters";

// Master-row type dot colors — distinct from the .stamp hue classes the
// timeline/category rows use (design calls for a plain dot here, not a pill).
const TYPE_DOT_COLOR: Record<InvoiceType, string> = {
  released_funds: "#5f7d72",
  labor: "var(--accent)",
  materials_services: "#5a7a4a",
  others: "#a08454",
  return: "#c98e2b",
};

interface ExpenseSplitViewProps {
  /** Already search/filter/tag-filtered invoices for the current view. */
  invoices: Invoice[];
  projectId: string;
  canManageInvoices: boolean;
  companyName: string | null;
  onMutated: () => void;
}

/** Date-desc comparator over `issue_date` (mirrors expense-grouping.ts). */
function byIssueDateDesc(a: Invoice, b: Invoice): number {
  if (a.issue_date === b.issue_date) return 0;
  return a.issue_date > b.issue_date ? -1 : 1;
}

export function ExpenseSplitView({
  invoices,
  projectId,
  canManageInvoices,
  companyName,
  onMutated,
}: ExpenseSplitViewProps) {
  const t = useTranslations("invoices");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sorted = useMemo(() => [...invoices].sort(byIssueDateDesc), [invoices]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const didHydrateFromUrl = useRef(false);

  // Keep the selection valid against the current (filtered) list: on first
  // mount, prefer a `?invoice=` id from the URL if it's actually in the
  // list; otherwise default to the first row. Whenever the current
  // selection drops out of the filtered list later (e.g. a filter change),
  // re-default to the first row too. This synchronizes local state with two
  // external inputs (the `invoices` prop, fetched by the parent, and the
  // URL) that can't be resolved at render time — the URL param is stripped
  // as a side effect on first consumption regardless of whether the id was
  // found, so a stale/foreign id never lingers to reopen the drawer later
  // (e.g. after switching to Timeline/Category).
  useEffect(() => {
    if (selectedId && sorted.some((inv) => inv.id === selectedId)) return;

    if (!didHydrateFromUrl.current) {
      didHydrateFromUrl.current = true;
      const fromUrl = searchParams.get("invoice");
      if (fromUrl) {
        const found = sorted.some((inv) => inv.id === fromUrl);
        if (found) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedId(fromUrl);
        }
        const params = new URLSearchParams(searchParams.toString());
        params.delete("invoice");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        if (found) return;
      }
    }

    setSelectedId(sorted[0]?.id ?? null);
  }, [sorted, selectedId, searchParams, router, pathname]);

  const selected = sorted.find((inv) => inv.id === selectedId) ?? null;

  return (
    <div
      className="hidden gap-4 lg:grid"
      style={{ gridTemplateColumns: "400px 1fr", alignItems: "start" }}
      data-testid="expense-split-view"
    >
      <div className="folio-card overflow-hidden">
        {sorted.map((invoice) => {
          const isSelected = invoice.id === selectedId;
          const methodLabel = invoice.payment_method_label?.trim()
            ? localizeMethodLabel(invoice.payment_method_label, tBuiltins)
            : "";
          return (
            <button
              key={invoice.id}
              type="button"
              onClick={() => setSelectedId(invoice.id)}
              aria-current={isSelected}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              style={{
                borderBottom: "1px solid var(--paper-2)",
                borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                background: isSelected ? "var(--paper-2)" : undefined,
              }}
            >
              <span
                className="h-[9px] w-[9px] flex-none rounded-full"
                style={{ background: TYPE_DOT_COLOR[invoice.type] }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{invoice.recipient_name}</div>
                <div
                  className="mt-0.5 flex items-center gap-1.5 text-[11.5px]"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="num">{formatDate(invoice.issue_date)}</span>
                  {methodLabel && (
                    <>
                      <span>·</span>
                      <span className="stamp max-w-[150px] truncate">{methodLabel}</span>
                    </>
                  )}
                </div>
              </div>
              <div
                className={`num flex-none text-[13px] font-medium${
                  invoice.total_amount < 0 ? " text-destructive" : ""
                }`}
              >
                {formatEUR(invoice.total_amount)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky top-4">
        {selected ? (
          <div className="folio-card p-[22px]" data-testid="expense-split-detail">
            <InvoiceDetailRow
              projectId={projectId}
              invoiceId={selected.id}
              canManage={canManageInvoices}
              colSpan={1}
              onMutated={onMutated}
              onCollapse={() => setSelectedId(null)}
              companyName={companyName}
              asCard
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center px-10 py-16 text-center text-[13px]"
            style={{ border: "1px dashed var(--line-2)", borderRadius: 14, color: "var(--muted)" }}
          >
            {t("split.selectPrompt")}
          </div>
        )}
      </div>
    </div>
  );
}
