"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Invoice } from "@/types/invoice";
import { formatEUR, formatEURWhole } from "@/lib/utils/formatters";
import { PurseDial } from "./purse-dial";
import { useDataTip } from "./data-tip";

/**
 * "Two purses" expenses summary (design Expense Dataviz 1b).
 *
 * Dark total card + company/personal purse cards side by side: each purse has
 * a dial (spent share of its released funds, center = what's left) and a
 * per-type mini-bar breakdown. Refund invoices sit in a credit strip below,
 * outside both purses.
 *
 * Figure sourcing:
 * - Purse released/spent come from the backend meta — the authoritative
 *   buckets (flagged payment methods only, refunds netted, company-refunded
 *   rows reassigned).
 * - The dark card's total is a client-side sum over ALL expense rows (any
 *   payment method, refunds excluded — they live in the credit strip), so it
 *   always matches the table below even when some expenses carry no flagged
 *   method and therefore sit outside both meta buckets.
 * - Per-type rows are client-side attribution and may drift from the meta
 *   purse spent when refunds/unflagged rows exist; the purse headers stay
 *   the source of truth for who paid.
 */
export interface ExpenseSummaryMeta {
  fundsReleasedTotal: number;
  /** Optional: absent on older BE — falls back to total − personal. */
  fundsReleasedCompanyTotal?: number;
  fundsReleasedPersonalTotal?: number;
  companySpentTotal: number;
  personalSpentTotal: number;
}

interface ExpensePursesSummaryProps {
  /** Unfiltered project invoice list (all types). */
  invoices: Invoice[];
  meta: ExpenseSummaryMeta;
}

const EXPENSE_TYPES = ["labor", "materials_services", "others"] as const;
type ExpenseType = (typeof EXPENSE_TYPES)[number];

const TYPE_BAR_COLOR: Record<ExpenseType, string> = {
  labor: "var(--accent)",
  materials_services: "var(--ink-2)",
  others: "var(--muted-2)",
};

// Personal-purse card border — same tint `.stamp.accent` uses in globals.css.
const PERSONAL_CARD_BORDER = "#f1c8a3";
// "Still available" on the dark ink card: --positive is too dark against ink;
// this is its light-on-dark counterpart from the design doc.
const AVAILABLE_ON_DARK = "#a8c48f";

interface PurseBreakdown {
  count: number;
  /** Client-side sum across the three expense types (mini-bar denominator). */
  spent: number;
  types: Record<ExpenseType, { total: number; count: number }>;
}

/**
 * Mirrors the BE bucket rule: a personally-paid expense the company already
 * reimbursed (status refunded, not by bank) counts as company money.
 */
function isPersonalExpense(inv: Invoice): boolean {
  return (
    Boolean(inv.paid_by_personal) &&
    !(inv.refundable_status === "refunded" && inv.refunded_by !== "bank")
  );
}

function emptyBreakdown(): PurseBreakdown {
  return {
    count: 0,
    spent: 0,
    types: {
      labor: { total: 0, count: 0 },
      materials_services: { total: 0, count: 0 },
      others: { total: 0, count: 0 },
    },
  };
}

export function ExpensePursesSummary({ invoices, meta }: ExpensePursesSummaryProps) {
  const t = useTranslations("invoices");
  const locale = useLocale();
  const { onMouseMove, onMouseLeave, overlay } = useDataTip();

  // ── Client-side attribution over the unfiltered list ──────────────────────
  const company = emptyBreakdown();
  const personal = emptyBreakdown();
  let refundableCount = 0;
  let minDate = "";
  let maxDate = "";
  const refunds = invoices.filter((i) => i.type === "refund");
  const refundsTotal = refunds.reduce((s, i) => s + i.total_amount, 0);

  for (const inv of invoices) {
    if (inv.type === "released_funds" || inv.type === "refund") continue;
    const purse = isPersonalExpense(inv) ? personal : company;
    purse.count += 1;
    const bucket = purse.types[inv.type as ExpenseType];
    if (bucket) {
      bucket.total += inv.total_amount;
      purse.spent += inv.total_amount;
      bucket.count += 1;
    }
    if (
      purse === personal &&
      (inv.refundable_status === "refundable" || inv.refundable_status === "refund_pending")
    ) {
      refundableCount += 1;
    }
    if (!minDate || inv.issue_date < minDate) minDate = inv.issue_date;
    if (!maxDate || inv.issue_date > maxDate) maxDate = inv.issue_date;
  }
  const expenseCount = company.count + personal.count;

  // ── Meta figures (purse headers) + client expense total (dark card) ───────
  const releasedTotal = meta.fundsReleasedTotal;
  const releasedPersonal = meta.fundsReleasedPersonalTotal ?? 0;
  const releasedCompany = meta.fundsReleasedCompanyTotal ?? releasedTotal - releasedPersonal;
  const spentTotal = company.spent + personal.spent;
  const availableTotal = Math.max(0, releasedTotal - spentTotal);
  const spentPct = releasedTotal > 0 ? Math.min(100, (spentTotal / releasedTotal) * 100) : 0;

  const monthYear = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const rangeText =
    minDate && maxDate
      ? ` · ${monthYear.format(new Date(minDate))} → ${monthYear.format(new Date(maxDate))}`
      : "";

  const purseCard = (
    title: string,
    stamp: React.ReactNode,
    dialColor: string,
    released: number,
    spent: number,
    breakdown: PurseBreakdown,
    borderColor?: string
  ) => {
    const left = Math.max(0, released - spent);
    const pct = released > 0 ? Math.min(100, (spent / released) * 100) : 0;
    return (
      <div
        className="folio-card flex flex-col gap-3.5 p-5"
        style={borderColor ? { borderColor } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="text-[12.5px] font-semibold">{title}</div>
          {stamp}
        </div>
        <div className="flex items-center gap-4">
          <PurseDial
            percent={pct}
            color={dialColor}
            centerValue={formatEURWhole(left)}
            centerLabel={t("summary.left")}
            dataTip={`${title}|${formatEURWhole(left)}|${t("summary.ofReleased", {
              amount: formatEURWhole(released),
            })}`}
          />
          <div className="flex flex-col gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
            <div>
              {t("summary.released")}{" "}
              <span className="num font-medium" style={{ color: "var(--ink)" }}>
                {formatEURWhole(released)}
              </span>
            </div>
            <div>
              {t("summary.spent")}{" "}
              <span className="num font-medium" style={{ color: "var(--ink)" }}>
                {formatEURWhole(spent)}
              </span>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--paper-2)" }} />
        <div className="flex flex-col gap-2.5">
          {EXPENSE_TYPES.map((type) => {
            const row = breakdown.types[type];
            const width = breakdown.spent > 0 ? (row.total / breakdown.spent) * 100 : 0;
            return (
              <div key={type} className="flex items-center gap-2.5">
                <span
                  className="w-24 flex-none truncate text-[11.5px]"
                  style={{ color: "var(--muted)" }}
                >
                  {t(`types.${type}`)}
                </span>
                <span
                  className="block h-[7px] flex-1 overflow-hidden rounded-full"
                  style={{ background: "var(--paper-2)" }}
                >
                  <span
                    className="block h-full rounded-full"
                    data-tip={`${title} · ${t(`types.${type}`)}|${formatEURWhole(row.total)}|${t(
                      "invoiceCount",
                      { n: row.count }
                    )}`}
                    style={{ width: `${width}%`, background: TYPE_BAR_COLOR[type] }}
                  />
                </span>
                <span className="num w-[72px] flex-none text-right text-[11.5px]">
                  {formatEURWhole(row.total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col gap-3.5"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-testid="expense-purses-summary"
    >
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[250px_1fr_1fr]">
        {/* Total expenses — dark card */}
        <div
          className="flex flex-col justify-between rounded-[14px] p-5"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          <div>
            <div className="label-cap" style={{ color: "var(--paper)", opacity: 0.6 }}>
              {t("summary.totalExpenses")}
            </div>
            <div
              className="num mt-2 text-[34px] font-medium leading-none"
              style={{ letterSpacing: "-.02em" }}
            >
              {formatEURWhole(spentTotal)}
            </div>
            <div className="mt-2 text-[11.5px]" style={{ opacity: 0.62 }}>
              {t("invoiceCount", { n: expenseCount })}
              {rangeText}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-1.5">
            <div className="flex justify-between text-[11.5px]" style={{ opacity: 0.72 }}>
              <span>{t("summary.releasedAllSources")}</span>
              <span className="num">{formatEURWhole(releasedTotal)}</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "color-mix(in srgb, var(--paper) 18%, transparent)" }}
            >
              <div
                className="h-full rounded-full"
                data-tip={`${t("summary.spent")}|${formatEURWhole(spentTotal)}|${t(
                  "summary.ofReleased",
                  { amount: formatEURWhole(releasedTotal) }
                )}`}
                style={{ width: `${spentPct}%`, background: "var(--accent)" }}
              />
            </div>
            <div className="flex justify-between text-[11.5px]">
              <span style={{ opacity: 0.72 }}>{t("summary.stillAvailable")}</span>
              <span className="num" style={{ color: AVAILABLE_ON_DARK }}>
                {formatEURWhole(availableTotal)}
              </span>
            </div>
          </div>
        </div>

        {purseCard(
          t("summary.companyPurse"),
          <span className="stamp">{t("invoiceCount", { n: company.count })}</span>,
          "var(--ink)",
          releasedCompany,
          meta.companySpentTotal,
          company
        )}
        {purseCard(
          t("summary.personalPurse"),
          refundableCount > 0 ? (
            <span className="stamp accent">
              {t("summary.refundableCount", { n: refundableCount })}
            </span>
          ) : (
            <span className="stamp">{t("invoiceCount", { n: personal.count })}</span>
          ),
          "var(--accent)",
          releasedPersonal,
          meta.personalSpentTotal,
          personal,
          PERSONAL_CARD_BORDER
        )}
      </div>

      {refunds.length > 0 && (
        <div
          className="flex items-center gap-2.5 rounded-[10px] bg-white px-3 py-2.5"
          style={{ border: "1px dashed var(--line-2)" }}
        >
          <span className="stamp warning">{t("summary.credit")}</span>
          <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            {t("summary.refundsReceived", { n: refunds.length })}
          </span>
          <span className="num ml-auto text-[12.5px] font-medium text-destructive">
            {formatEUR(refundsTotal)}
          </span>
        </div>
      )}

      {overlay}
    </div>
  );
}
