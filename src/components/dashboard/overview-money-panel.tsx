"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatEURExact, formatEURWhole } from "@/lib/utils/formatters";
import { formatPercent, formatShare } from "@/lib/utils/format-percent";
import { useDataTip } from "@/components/invoices/data-tip";
import { useChartLink } from "@/components/dashboard/use-chart-link";
import { expenseListHref, type ExpenseListFilters } from "@/lib/invoices/expense-filters";
import {
  monthKeyToDate,
  type BudgetMetrics,
  type MonthDelta,
  type MonthlySpendPoint,
  type MoneyPurseView,
  type PendingRefunds,
} from "@/lib/dashboard/overview-metrics";

// Dark-panel-only tints — no light-mode equivalent CSS var, kept literal
// (design Canvas 3a "4b ink money panel").
const NEGATIVE_ON_DARK = "#e8a58a";
const REFUND_PILL_BG = "rgba(232,132,60,0.16)";
const REFUND_PILL_BORDER = "rgba(241,200,163,0.35)";
const REFUND_PILL_TEXT = "#f1c8a3";
// Bank-channel pill — cool counterpart to the warm company pill, mirroring the
// emerald/sky company-vs-bank pairing RefundSourceIndicator established.
const BANK_PILL_BG = "rgba(60,132,232,0.16)";
const BANK_PILL_BORDER = "rgba(157,201,232,0.35)";
const BANK_PILL_TEXT = "#9dc9e8";
const DIAL_TRACK = "rgba(245,241,234,0.16)";
const DIVIDER = "rgba(245,241,234,0.12)";
const TRACK_BG = "rgba(245,241,234,0.14)";

const DIAL_SIZE = 56;
const DIAL_RADIUS = 24;
const DIAL_STROKE = 7;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

/**
 * Spend as a share of what was released into the purse. Nothing drawn at 0 %
 * (a round line cap used to leave a dot that read as "a little spent"), and a
 * purse that spent without any release gets a warning ring instead of an
 * empty track that looked like "nothing to worry about".
 */
function PurseMiniDial({ percent, color, unfunded = false }: { percent: number; color: string; unfunded?: boolean }) {
  const filled = (DIAL_CIRCUMFERENCE * Math.min(100, Math.max(0, percent))) / 100;
  return (
    <svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} aria-hidden="true" className="flex-none">
      <circle
        cx={DIAL_SIZE / 2}
        cy={DIAL_SIZE / 2}
        r={DIAL_RADIUS}
        fill="none"
        stroke={unfunded ? NEGATIVE_ON_DARK : DIAL_TRACK}
        strokeWidth={DIAL_STROKE}
        strokeDasharray={unfunded ? "4 4" : undefined}
        data-testid={unfunded ? "purse-dial-unfunded" : undefined}
      />
      {filled > 0 && (
      <circle
        cx={DIAL_SIZE / 2}
        cy={DIAL_SIZE / 2}
        r={DIAL_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={DIAL_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
      />
      )}
    </svg>
  );
}

export interface OverviewMoneyPanelProps {
  spentTotal: number;
  budgetMetrics: BudgetMetrics;
  monthlySeries: MonthlySpendPoint[];
  monthDelta: MonthDelta;
  pendingRefunds: PendingRefunds;
  /** Bank-channel outstanding — overlaps pendingRefunds by design; the two are
   * separate balances and are never summed. */
  bankOutstanding: PendingRefunds;
  purses: MoneyPurseView[];
  /** Expenses in neither purse (no company/personal payment method). */
  unassigned?: PendingRefunds;
  /** True while the underlying invoices fetch hasn't settled yet for the
   * current project — figures aren't real yet (e.g. spentTotal defaults to
   * 0), so show placeholders instead of a briefly-wrong "full budget
   * remaining" flash. */
  loading?: boolean;
  /**
   * Whether the caller holds `project:view_budget`. False drops everything
   * measured against the project's financing: the "remaining to spend"
   * headline (budget − spent), the credit progress bar, and the purse dials
   * (spend as a share of released funds). The spend figures the caller does
   * own — total spent, this month, the sparkline, outstanding refunds — stay.
   */
  canViewBudget?: boolean;
  /** Where the credit is set — linked when the project has no budget. */
  settingsHref?: string | null;
  /** The project's Expense list: every figure opens the expenses it adds up. */
  expensesHref?: string | null;
  /** The refundable expenses list for this project (pills open it per channel). */
  refundableHref?: string | null;
}

const PLACEHOLDER = "—";

/** Dark ink "ledger" card — headline credit remaining, this month's spend with
 * a 6-month sparkline, the credit progress bar, and the company/personal
 * purse mini-dials (design Canvas 3a, section "4b ink money panel"). */
export function OverviewMoneyPanel({
  spentTotal,
  budgetMetrics,
  monthlySeries,
  monthDelta,
  pendingRefunds,
  bankOutstanding,
  purses,
  unassigned,
  loading = false,
  canViewBudget = true,
  settingsHref = null,
  expensesHref = null,
  refundableHref = null,
}: OverviewMoneyPanelProps) {
  const t = useTranslations("dashboard");
  const tInvoices = useTranslations("invoices");
  const tProjects = useTranslations("projects");
  const tBankRelease = useTranslations("projects.bankRelease");
  // "Remaining to spend" and "% spent" need something to measure against: a
  // project with no credit and no released funds shows what was spent.
  const showRemaining = canViewBudget && budgetMetrics.hasBaseline;
  const locale = useLocale();
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const fig = (value: string) => (loading ? PLACEHOLDER : value);
  // Remaining, credit and spent are subtracted on cents and shown to the cent
  // when not whole: 150 000,50 − 4 199,40 reads 145 801,10 €, never 150 001 −
  // 4 199 = 145 802 €.
  const shownLeft = budgetMetrics.left;
  const { tipHandlers, overlay } = useDataTip();
  const chartLink = useChartLink();
  const listHref = (filters: ExpenseListFilters) =>
    expensesHref ? expenseListHref(expensesHref, filters) : null;
  const refundHref = (channel: "company" | "bank") =>
    refundableHref ? `${refundableHref}${refundableHref.includes("?") ? "&" : "?"}channel=${channel}` : null;
  const monthYearFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  /** A figure that opens its expenses when there is a list to open. */
  const linked = (href: string | null, node: React.ReactNode, label?: string) =>
    href && !loading ? (
      <Link href={href} className="hover:underline underline-offset-2" aria-label={label}>
        {node}
      </Link>
    ) : (
      node
    );

  const sparkMax = Math.max(...monthlySeries.map((p) => p.total), 1);
  const sparkX = (i: number) => 4 + i * 30;
  // A net-negative month (returns above purchases) sits on the baseline, as
  // the bar charts floor it; unfloored it would be drawn far below the chart.
  const sparkY = (v: number) => 38 - (Math.max(0, v) / sparkMax) * 30;
  const sparkPts = monthlySeries.map((p, i) => ({ x: sparkX(i), y: sparkY(p.total) }));
  const lastIdx = sparkPts.length - 1;
  const sparkArea =
    sparkPts.length > 0
      ? `M${sparkPts[0].x},38 L${sparkPts.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" L")} L${sparkPts[lastIdx].x},38 Z`
      : "";
  const sparkLine = sparkPts.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" ");

  const company = purses.find((p) => p.key === "company");
  const personal = purses.find((p) => p.key === "personal");

  const purseRow = (
    purse: MoneyPurseView | undefined,
    title: string,
    stamp: string,
    dialColor: string
  ) => {
    if (!purse) return null;
    const pct = purse.released > 0 ? (purse.spent / purse.released) * 100 : 0;
    const left = purse.released - purse.spent;
    // Nothing released into this purse: "left" would just be minus what was
    // spent, drawn as an overdraft. Show the spend instead.
    const hasReleased = purse.released > 0;
    const href = listHref({ purse: purse.key });
    return (
      <div className="flex items-center gap-4" data-testid={`overview-purse-${purse.key}`}>
        {href && !loading ? (
          <Link href={href} aria-label={t("money.openExpenses", { what: title })} className="flex-none rounded-full">
            <PurseMiniDial percent={pct} color={dialColor} unfunded={!hasReleased && purse.spent > 0} />
          </Link>
        ) : (
          <PurseMiniDial percent={pct} color={dialColor} unfunded={!hasReleased && purse.spent > 0} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] font-semibold">{linked(href, title)}</span>
            <span className="text-[10.5px] uppercase tracking-[0.05em]" style={{ opacity: 0.55 }}>
              {loading ? PLACEHOLDER : stamp}
            </span>
          </div>
          <div
            className="num mt-1 text-[17px] font-medium"
            style={{
              letterSpacing: "-.02em",
              color: !loading && hasReleased && left < 0 ? NEGATIVE_ON_DARK : undefined,
            }}
          >
            {fig(formatEURWhole(hasReleased ? left : purse.spent))}{" "}
            <span className="font-sans text-[11px]" style={{ opacity: 0.6 }}>
              {hasReleased ? tInvoices("summary.left") : t("money.purseSpent")}
            </span>
          </div>
          <div className="mt-0.5 text-[11px]" style={{ opacity: 0.62 }}>
            {tInvoices("summary.released")} <span className="num">{fig(formatEURWhole(purse.released))}</span>
            {" · "}
            {tInvoices("summary.spent")} <span className="num">{fig(formatEURWhole(purse.spent))}</span>
          </div>
          {purse.cashAdvanced > 0 && (
            <div
              className="mt-0.5 text-[11px]"
              style={{ color: "var(--accent-ink)" }}
              data-testid={`overview-purse-cash-${purse.key}`}
            >
              {tInvoices("summary.cashAdvance", { amount: fig(formatEURWhole(purse.cashAdvanced)) })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-[14px] p-6"
      style={{ background: "var(--ink)", color: "var(--paper)", opacity: loading ? 0.55 : 1, transition: "opacity 150ms" }}
      data-testid="overview-money-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-wrap items-start gap-9">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ opacity: 0.6 }}>
              {showRemaining ? tProjects("remainingToSpend") : tInvoices("summary.spent")}
            </div>
            <div
              className="num mt-2 text-[34px] font-medium leading-none"
              style={{
                letterSpacing: "-.02em",
                color:
                  !loading && showRemaining && budgetMetrics.left < 0 ? NEGATIVE_ON_DARK : undefined,
              }}
            >
              {fig(formatEURExact(showRemaining ? shownLeft : spentTotal))}
            </div>
          </div>
          <div className="flex items-end gap-6" style={{ borderLeft: "1px solid rgba(245,241,234,0.14)", paddingLeft: 32 }}>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ opacity: 0.6 }}>
                {t("money.spentThisMonth")}
              </div>
              <div className="num mt-2.5 text-[24px] font-medium leading-none" style={{ letterSpacing: "-.02em" }}>
                {linked(
                  monthDelta.current.key ? listHref({ month: monthDelta.current.key }) : null,
                  fig(formatEURWhole(monthDelta.current.total))
                )}
              </div>
              <div className="mt-1.5 text-[11px]" style={{ opacity: 0.62 }}>
                {loading ? (
                  PLACEHOLDER
                ) : (
                  <>
                    {/* Neutral: spending less is not good or bad by itself. While the
                        month runs, both months are cut at today's day. */}
                    {monthDelta.deltaPct !== null && monthDelta.previous && (
                      <span>
                        {monthDelta.toDay
                          ? t("money.vsMonthToDate", {
                              delta: formatPercent(locale, monthDelta.deltaPct, true),
                              day: monthDelta.toDay,
                              month: monthFmt.format(monthKeyToDate(monthDelta.previous.key)),
                            })
                          : tInvoices("summary.vsMonth", {
                              delta: formatPercent(locale, monthDelta.deltaPct, true),
                              month: monthFmt.format(monthKeyToDate(monthDelta.previous.key)),
                            })}
                        {" · "}
                      </span>
                    )}
                    {tInvoices("invoiceCount", { n: monthDelta.current.count })}
                  </>
                )}
              </div>
            </div>
            {!loading && sparkPts.length > 0 && (
              <div {...tipHandlers}>
                <svg width={158} height={40} viewBox="0 0 158 40" role="group" aria-label={t("money.spentThisMonth")}>
                  <path d={sparkArea} fill="rgba(232,132,60,0.14)" />
                  <polyline points={sparkLine} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {sparkPts.map((p, i) => (
                    <circle
                      key={monthlySeries[i].key}
                      cx={p.x}
                      cy={p.y.toFixed(1)}
                      r={i === lastIdx ? 3 : 2}
                      fill={i === lastIdx ? "var(--accent)" : "rgba(245,241,234,0.55)"}
                      stroke={i === lastIdx ? "var(--ink)" : undefined}
                      strokeWidth={i === lastIdx ? 1.5 : undefined}
                    />
                  ))}
                  {/* One hit column per month: its amount on hover or focus, its expenses on click. */}
                  {monthlySeries.map((p, i) => {
                    const label = `${monthYearFmt.format(monthKeyToDate(p.key))}|${formatEURWhole(p.total)}|${tInvoices(
                      "invoiceCount",
                      { n: p.count }
                    )}`;
                    return (
                      <rect
                        key={`${p.key}-hit`}
                        x={sparkX(i) - 15}
                        y={0}
                        width={30}
                        height={40}
                        fill="transparent"
                        data-tip={label}
                        data-testid={`overview-spark-${p.key}`}
                        {...chartLink(listHref({ month: p.key }), label.split("|").join(" · "))}
                      />
                    );
                  })}
                </svg>
                <div className="mt-0.5 flex justify-between text-[9.5px]" style={{ opacity: 0.5 }}>
                  <span>{monthFmt.format(monthKeyToDate(monthlySeries[0].key))}</span>
                  <span>{monthFmt.format(monthKeyToDate(monthlySeries[lastIdx].key))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Two independent outstanding balances, one per reimbursement channel.
            They overlap — an expense neither side refunded counts in both — so
            each pill names its own channel and they are never summed. */}
        {!loading && (pendingRefunds.count > 0 || bankOutstanding.count > 0) && (
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {pendingRefunds.count > 0 && (
              <RefundPill
                href={refundHref("company")}
                style={{ background: REFUND_PILL_BG, border: `1px solid ${REFUND_PILL_BORDER}`, color: REFUND_PILL_TEXT }}
                testId="dashboard-refundable-by-company"
              >
                {tInvoices("summary.refundableByCompany")} · {formatEURWhole(pendingRefunds.total)}
              </RefundPill>
            )}
            {bankOutstanding.count > 0 && (
              <RefundPill
                href={refundHref("bank")}
                style={{ background: BANK_PILL_BG, border: `1px solid ${BANK_PILL_BORDER}`, color: BANK_PILL_TEXT }}
                testId="dashboard-refundable-by-bank"
              >
                {tInvoices("summary.refundableByBank")} · {formatEURWhole(bankOutstanding.total)}
              </RefundPill>
            )}
          </span>
        )}
      </div>

      {/* Credit progress + purse dials are measured against the project's
          financing, so both are budget-gated. */}
      {canViewBudget && !loading && !budgetMetrics.hasBaseline && (
        <div className="mt-[18px] text-[12px]" style={{ opacity: 0.75 }} data-testid="overview-no-budget">
          {tBankRelease("noCredit")}
          {settingsHref && (
            <>
              {" · "}
              <Link href={settingsHref} className="font-medium underline underline-offset-2">
                {tBankRelease("openSettings")}
              </Link>
            </>
          )}
        </div>
      )}

      {canViewBudget && (loading || budgetMetrics.hasBaseline) && (
        <div className="mt-[18px]">
          {linked(
            listHref({}),
            <div
              className="relative h-[10px] overflow-hidden rounded-full"
              style={{ background: TRACK_BG }}
              data-testid="overview-credit-bar"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: "var(--accent)", width: loading ? "0%" : `${budgetMetrics.pctClamped}%` }}
              />
            </div>,
            t("money.openExpenses", { what: tInvoices("summary.spent") })
          )}
          {/* The caption gets its own line on a phone instead of running into
              the two axis amounts ("0 €5 % du crédit…"). */}
          <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px]" style={{ opacity: 0.62 }}>
            <span className="order-2 sm:order-1">{formatEURWhole(0)}</span>
            <span className="order-1 w-full sm:order-2 sm:w-auto">
              <span className="num">
                {loading
                  ? PLACEHOLDER
                  : t(budgetMetrics.usesBudget ? "money.pctCreditDrawn" : "money.pctSpent", {
                      pct: formatShare(locale, budgetMetrics.pctExact),
                      spent: formatEURExact(budgetMetrics.spent),
                    })}
              </span>
            </span>
            <span className="order-3">{fig(formatEURExact(budgetMetrics.denominator))}</span>
          </div>
        </div>
      )}

      {canViewBudget && (
        <div className="mt-5 grid grid-cols-1 gap-8 pt-5 sm:grid-cols-2" style={{ borderTop: `1px solid ${DIVIDER}` }}>
          {purseRow(
            company,
            tInvoices("summary.companyPurse"),
            tInvoices("invoiceCount", { n: company?.count ?? 0 }),
            "var(--paper)"
          )}
          {purseRow(
            personal,
            tInvoices("summary.personalPurse"),
            pendingRefunds.count > 0
              ? `${tInvoices("summary.refundableCount", { n: pendingRefunds.count })} · ${formatEURWhole(pendingRefunds.total)}`
              : tInvoices("invoiceCount", { n: personal?.count ?? 0 }),
            "var(--accent)"
          )}
          {!loading && unassigned && unassigned.count > 0 && (
            <div
              className="text-[11px] sm:col-span-2"
              style={{ opacity: 0.62 }}
              data-testid="overview-unassigned-spend"
            >
              {linked(
                listHref({ purse: "none" }),
                t("money.unassigned", { n: unassigned.count, amount: formatEURWhole(unassigned.total) })
              )}
            </div>
          )}
        </div>
      )}
      {overlay}
    </div>
  );
}

/** A refund balance; a link to those expenses when the refundable list is reachable. */
function RefundPill({
  href,
  style,
  testId,
  children,
}: {
  href: string | null;
  style: React.CSSProperties;
  testId: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.05em]";
  return href ? (
    <Link href={href} className={`${className} hover:underline`} style={style} data-testid={testId}>
      {children}
    </Link>
  ) : (
    <span className={className} style={style} data-testid={testId}>
      {children}
    </span>
  );
}
