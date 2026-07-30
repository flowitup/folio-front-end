"use client";

/**
 * Desktop grouped-card list for the Expense page — renders the sections
 * produced by `groupByTimeline`/`groupByCategory` (src/lib/invoices/expense-grouping.ts)
 * as year/month or category headers, each wrapping a `folio-card` of rows.
 *
 * Row click keeps the existing `?invoice=` inline-toggle: the clicked row's
 * `InvoiceDetailRow` (asCard mode, same component the mobile card list uses)
 * renders directly below it inside the card. A future phase moves this into
 * a drawer — the wiring here is deliberately localized to `onToggle` so that
 * swap stays a small, contained change.
 */

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { Invoice, InvoiceType } from "@/types/invoice";
import type { ExpenseGroupSection } from "@/lib/invoices/expense-grouping";
import type { ExpenseViewVariant } from "@/components/invoices/expense-row";
import { ExpenseRow } from "@/components/invoices/expense-row";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { formatEUR } from "@/lib/utils/formatters";

interface ExpenseGroupedListProps {
  variant: ExpenseViewVariant;
  sections: ExpenseGroupSection[];
  selectedInvoiceId: string | null;
  onToggle: (id: string) => void;
  companyName: string | null;
  typeStampClass: Record<InvoiceType, string>;
  projectId: string;
  canManageInvoices: boolean;
  onMutated: () => void;
  onCollapse: () => void;
}

export function ExpenseGroupedList({
  variant,
  sections,
  selectedInvoiceId,
  onToggle,
  companyName,
  typeStampClass,
  projectId,
  canManageInvoices,
  onMutated,
  onCollapse,
}: ExpenseGroupedListProps) {
  const t = useTranslations("invoices");

  return (
    <div className="hidden lg:block" data-testid="invoices-table-desktop">
      <div className="flex flex-col gap-[18px]">
        {sections.map((section) => (
          <div key={section.key}>
            {section.hasYearHeader && (
              <div className="mt-1.5 mb-3.5 flex items-center gap-3.5">
                <div
                  className="font-display text-[26px] font-semibold"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {section.yearLabel}
                </div>
                <div
                  className="h-px flex-1"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, var(--line-2) 0 6px, transparent 6px 12px)",
                  }}
                />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {t("grouped.entries", { n: section.yearCount ?? 0 })} · {t("grouped.net")}{" "}
                  <span className="num font-medium" style={{ color: "var(--ink)" }}>
                    {formatEUR(section.yearNet ?? 0)}
                  </span>
                </span>
              </div>
            )}

            <div className="mb-2 flex items-baseline gap-3 px-1">
              <h2
                className="font-display text-[18px] font-semibold"
                style={{ letterSpacing: "-0.01em" }}
              >
                {section.headerLabel}
              </h2>
              {variant === "category" && section.type && (
                <span className={typeStampClass[section.type]} style={{ fontSize: 10.5 }}>
                  {t("grouped.entries", { n: section.count })}
                </span>
              )}
              <div className="h-px flex-1 self-center" style={{ background: "var(--line)" }} />
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                {t("grouped.entries", { n: section.count })} · {t("grouped.net")}{" "}
                <span className="num font-medium" style={{ color: "var(--ink)" }}>
                  {formatEUR(section.net)}
                </span>
              </span>
            </div>

            <div className="folio-card overflow-hidden">
              {section.rows.map((invoice: Invoice) => {
                const isOpen = selectedInvoiceId === invoice.id;
                const detailId = `invoice-detail-${invoice.id}`;
                return (
                  <Fragment key={invoice.id}>
                    <ExpenseRow
                      invoice={invoice}
                      variant={variant}
                      isOpen={isOpen}
                      onOpen={() => onToggle(invoice.id)}
                      companyName={companyName}
                      typeStampClass={typeStampClass}
                      regionId={detailId}
                    />
                    {isOpen && (
                      <InvoiceDetailRow
                        projectId={projectId}
                        invoiceId={invoice.id}
                        canManage={canManageInvoices}
                        colSpan={1}
                        regionId={detailId}
                        onMutated={onMutated}
                        onCollapse={onCollapse}
                        companyName={companyName}
                        asCard
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
