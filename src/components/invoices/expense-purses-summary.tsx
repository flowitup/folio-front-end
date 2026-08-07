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
 * per-type mini-bar breakdown. The dark card's lower block shows the pending
 * personal-refund amount and a month-by-month spend timeline since project
 * start (latest month highlighted, with a delta vs the previous month).
 * Refund invoices sit in a credit strip below, outside both purses.
 *
 * Figure sourcing:
 * - Purse released/spent come from the backend meta — the authoritative
 *   buckets (flagged payment methods only, refunds netted, company-refunded
 *   rows reassigned).
 * - The dark card's total is a client-side sum over ALL expense rows (any
 *   payment method) NET of refunds: each `return` row is subtracted from the
 *   purse that received the money back, so Total = company spent + personal
 *   spent. The credit strip below still itemizes the refunds received.
 * - Per-type rows are client-side attribution, also net of refunds — a refund
 *   is deducted from the category of the invoice it refunds (fallback:
 *   materials & services, the only refund-tracked type). They may still drift
 *   from the meta purse spent when unflagged rows exist; the purse headers
 *   stay the source of truth for who paid.
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
// Pending-refunds amount on the dark ink card — the warm tint the refundable
// stamp family uses, readable on ink.
const PENDING_ON_DARK = "#f1c8a3";

/** First day of the month for a "YYYY-MM" key — numeric args avoid the
 * UTC-midnight day-shift of parsing date-only strings. */
function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

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
  let refundableTotal = 0;
  let minDate = "";
  let maxDate = "";
  // Spend per month since project start. Labor attributes to its service_month
  // (payment month can lag the work), everything else to issue_date.
  const monthlySpend: Record<string, { total: number; count: number }> = {};
  const refunds = invoices.filter((i) => i.type === "return");
  const refundsTotal = refunds.reduce((s, i) => s + i.total_amount, 0);

  for (const inv of invoices) {
    if (inv.type === "released_funds" || inv.type === "return") continue;
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
      refundableTotal += inv.total_amount;
    }
    const monthKey = (inv.service_month ?? inv.issue_date).slice(0, 7);
    const month = (monthlySpend[monthKey] ??= { total: 0, count: 0 });
    month.total += inv.total_amount;
    month.count += 1;
    if (!minDate || inv.issue_date < minDate) minDate = inv.issue_date;
    if (!maxDate || inv.issue_date > maxDate) maxDate = inv.issue_date;
  }
  const expenseCount = company.count + personal.count;

  // ── Net refunds into the purses ───────────────────────────────────────────
  // Each `return` is subtracted from the purse that received the money back
  // (its own paid_by flags — mirrors the BE netting) and from the category of
  // the invoice it refunds. Unlinked refunds fall back to materials & services,
  // the only refund-tracked type. Counts stay expense-only: the credit strip
  // below carries the refund count.
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  for (const ref of refunds) {
    const purse = isPersonalExpense(ref) ? personal : company;
    const sourceType = ref.refunds_invoice_id
      ? invoiceById.get(ref.refunds_invoice_id)?.type
      : undefined;
    const type: ExpenseType = (EXPENSE_TYPES as readonly string[]).includes(
      sourceType ?? ""
    )
      ? (sourceType as ExpenseType)
      : "materials_services";
    purse.types[type].total += ref.total_amount; // negative amount
    purse.spent += ref.total_amount;
  }

  // ── Meta figures (purse headers) + client expense total (dark card) ───────
  const releasedTotal = meta.fundsReleasedTotal;
  const releasedPersonal = meta.fundsReleasedPersonalTotal ?? 0;
  const releasedCompany = meta.fundsReleasedCompanyTotal ?? releasedTotal - releasedPersonal;
  const spentTotal = company.spent + personal.spent;

  // ── Month series from the first to the last active month, gaps filled ─────
  const monthKeys = Object.keys(monthlySpend).sort();
  const monthSeries: { key: string; total: number; count: number }[] = [];
  if (monthKeys.length > 0) {
    let [y, m] = monthKeys[0].split("-").map(Number);
    const [endY, endM] = monthKeys[monthKeys.length - 1].split("-").map(Number);
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      monthSeries.push({ key, ...(monthlySpend[key] ?? { total: 0, count: 0 }) });
      if (m === 12) {
        y += 1;
        m = 1;
      } else {
        m += 1;
      }
    }
  }
  const maxMonthTotal = Math.max(...monthSeries.map((mo) => mo.total), 0);
  const lastMonth = monthSeries[monthSeries.length - 1];
  const prevMonth = monthSeries[monthSeries.length - 2];
  const deltaPct =
    lastMonth && prevMonth && prevMonth.total > 0
      ? Math.round(((lastMonth.total - prevMonth.total) / prevMonth.total) * 100)
      : null;

  const monthYear = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const monthOnly = new Intl.DateTimeFormat(locale, { month: "short" });
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
    const left = released - spent;
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
            centerValueColor={left < 0 ? "var(--negative)" : undefined}
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
            // Clamp to [0, 100]: refund netting can push a small category
            // negative (over-refunded), which must not render a negative bar.
            const width =
              breakdown.spent > 0
                ? Math.min(100, Math.max(0, (row.total / breakdown.spent) * 100))
                : 0;
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
            <div className="flex justify-between text-[11.5px]">
              <span style={{ opacity: 0.72 }}>{t("summary.pendingRefunds")}</span>
              <span className="num" style={{ color: PENDING_ON_DARK }}>
                {formatEURWhole(refundableTotal)}
              </span>
            </div>
            {monthSeries.length > 0 && (
              <>
                <div
                  className="flex h-[30px] items-end gap-[3px]"
                  data-testid="monthly-spend-bars"
                >
                  {monthSeries.map((mo, i) => (
                    <span
                      key={mo.key}
                      className="flex-1 rounded-[2px]"
                      data-tip={`${monthYear.format(monthDate(mo.key))}|${formatEURWhole(
                        mo.total
                      )}|${t("invoiceCount", { n: mo.count })}`}
                      style={{
                        // 4% floor keeps zero/tiny months visible in the timeline.
                        height: `${
                          maxMonthTotal > 0
                            ? Math.max((mo.total / maxMonthTotal) * 100, 4)
                            : 4
                        }%`,
                        background:
                          i === monthSeries.length - 1
                            ? "var(--accent)"
                            : "color-mix(in srgb, var(--paper) 32%, transparent)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[11.5px]">
                  <span style={{ opacity: 0.72 }}>{monthYear.format(monthDate(lastMonth.key))}</span>
                  <span>
                    <span className="num">{formatEURWhole(lastMonth.total)}</span>
                    {deltaPct !== null && (
                      <span style={{ opacity: 0.62 }}>
                        {" · "}
                        {t("summary.vsMonth", {
                          delta: `${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
                          month: monthOnly.format(monthDate(prevMonth.key)),
                        })}
                      </span>
                    )}
                  </span>
                </div>
              </>
            )}
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
              {" · "}
              <span className="num">{formatEURWhole(refundableTotal)}</span>
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
