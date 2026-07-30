"use client";

/**
 * Desktop grouped-card list for the Expense page — renders the sections
 * produced by `groupByTimeline`/`groupByCategory` (src/lib/invoices/expense-grouping.ts)
 * as year/month or category headers, each wrapping a `folio-card` of rows.
 *
 * Row click sets `?invoice=` on the page (via `onToggle`) so the detail
 * drawer (`ExpenseDetailDrawer`, mounted once at the page level) opens with
 * that invoice. The clicked row is highlighted (`isOpen`) while the drawer
 * is showing it — no detail content renders inline here anymore.
 */

import { useTranslations } from "next-intl";
import type { Invoice, InvoiceType } from "@/types/invoice";
import type { ExpenseGroupSection } from "@/lib/invoices/expense-grouping";
import type { ExpenseViewVariant } from "@/components/invoices/expense-row";
import { ExpenseRow } from "@/components/invoices/expense-row";
import { formatEUR } from "@/lib/utils/formatters";

interface ExpenseGroupedListProps {
  variant: ExpenseViewVariant;
  sections: ExpenseGroupSection[];
  selectedInvoiceId: string | null;
  onToggle: (id: string) => void;
  companyName: string | null;
  typeStampClass: Record<InvoiceType, string>;
}

export function ExpenseGroupedList({
  variant,
  sections,
  selectedInvoiceId,
  onToggle,
  companyName,
  typeStampClass,
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
                return (
                  <ExpenseRow
                    key={invoice.id}
                    invoice={invoice}
                    variant={variant}
                    isOpen={isOpen}
                    onOpen={() => onToggle(invoice.id)}
                    companyName={companyName}
                    typeStampClass={typeStampClass}
                    regionId={`invoice-detail-${invoice.id}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
