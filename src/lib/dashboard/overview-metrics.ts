/**
 * Pure aggregation helpers for the dashboard "Ledger desk" overview (design
 * Canvas 3a). Framework-free — take plain `Invoice[]`/numbers, return plain
 * data the presentational components render. Kept separate from the
 * components so the money math is unit-testable without mounting React.
 *
 * Expense attribution mirrors `expense-purses-summary.tsx` (the Expense page
 * "Two purses" dataviz): a personally-paid expense the company already
 * reimbursed (status refunded, not by bank) counts as company money, and
 * `released_funds` rows are excluded from "spend" — they mark money moving
 * into the project, not a purchase.
 *
 * Spend here is NET of returns, so every overview figure reconciles with the
 * Expense page's total-expenses card and with the purse figures beside it
 * (which come from backend meta and were always net). A return is attributed
 * on two independent axes:
 *
 * - MONTH: the return's own issue month, never the refunded invoice's. This
 *   matches `groupInvoicesByMonth`, whose ledger subtotals already net a
 *   credit into the month it landed (and already go negative when a month is
 *   return-heavy). Netting into the refunded invoice's month instead would
 *   retroactively rewrite months that have already been reported.
 * - TYPE: the type of the invoice it refunds, falling back to
 *   materials_services for unlinked returns — the same rule
 *   `expense-type-breakdown.tsx` uses, and the only refund-tracked type.
 *
 * Each month point carries its own `credited`/`creditCount` alongside the net
 * total, so a chart can mark the months where a credit landed and explain a
 * dip in place rather than leaving it mysterious. A month whose returns exceed
 * its purchases has a negative total; callers floor bar heights, so it draws
 * as a baseline stub while the figure itself stays truthful.
 */
import type { Invoice, InvoiceType } from "@/types/invoice";

export type ExpenseType = Extract<InvoiceType, "labor" | "materials_services" | "others">;
export const EXPENSE_TYPES: readonly ExpenseType[] = ["labor", "materials_services", "others"];

function isSpendInvoice(inv: Invoice): boolean {
  return inv.type === "labor" || inv.type === "materials_services" || inv.type === "others";
}

function isExpenseType(t: InvoiceType | undefined): t is ExpenseType {
  return t === "labor" || t === "materials_services" || t === "others";
}

/** Mirrors the BE bucket rule (see expense-purses-summary.tsx). */
export function isPersonalExpense(inv: Invoice): boolean {
  return (
    Boolean(inv.paid_by_personal) &&
    !(inv.refundable_status === "refunded" && inv.refunded_by !== "bank")
  );
}

function monthKeyOf(inv: Invoice): string {
  return (inv.service_month ?? inv.issue_date).slice(0, 7);
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First-of-month `Date` from a "YYYY-MM" key, built from numeric parts to
 * avoid the UTC-midnight day-shift of parsing date-only strings. */
export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export interface ReturnCredit {
  /** Category the credit reduces — see the module docstring. */
  type: ExpenseType;
  /** "YYYY-MM" the credit landed in — the return's own month. */
  monthKey: string;
  /** Negative, straight from the return invoice. */
  amount: number;
}

/**
 * One credit per `return` invoice, resolved onto the (type, month) axes the
 * spend aggregations bucket by. Returns are excluded from `isSpendInvoice`,
 * so every aggregation that wants to be net folds these in on top.
 */
export function buildReturnCredits(invoices: Invoice[]): ReturnCredit[] {
  const typeById = new Map(invoices.map((i) => [i.id, i.type]));
  const credits: ReturnCredit[] = [];
  for (const inv of invoices) {
    if (inv.type !== "return") continue;
    const sourceType = inv.refunds_invoice_id ? typeById.get(inv.refunds_invoice_id) : undefined;
    credits.push({
      type: isExpenseType(sourceType) ? sourceType : "materials_services",
      monthKey: monthKeyOf(inv),
      amount: inv.total_amount,
    });
  }
  return credits;
}

/** All-time sum across spend invoices, net of returns — the same client-side
 * total the Expense page's dark "Total expenses" card shows. */
export function computeSpentTotal(invoices: Invoice[]): number {
  const spend = invoices.filter(isSpendInvoice).reduce((s, i) => s + i.total_amount, 0);
  return buildReturnCredits(invoices).reduce((s, c) => s + c.amount, spend);
}

export interface MonthlySpendPoint {
  /** "YYYY-MM" */
  key: string;
  /** Net of the returns credited to this month — may be negative. */
  total: number;
  /** Expenses only; credits are not expenses and never inflate this. */
  count: number;
  /** Σ of returns credited to this month — negative, 0 when none. */
  credited: number;
  /** How many return invoices landed in this month. */
  creditCount: number;
}

/**
 * Last `months` calendar months ending at `referenceDate`'s month, gap-filled
 * with zero totals so the series is always exactly `months` long. Attributes
 * labor to its `service_month` (payment can lag the work); everything else
 * to `issue_date`.
 *
 * `credits` are folded into month totals but never into counts: a return is a
 * credit, not an expense, so "N expenses" keeps meaning what it says while the
 * money figure goes net. Defaults to the returns found in `invoices`, so a
 * caller passing the full list gets net figures with no extra wiring; callers
 * working on a pre-filtered slice (per type) pass their own.
 */
export function buildMonthlySpendSeries(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date(),
  credits: ReturnCredit[] = buildReturnCredits(invoices)
): MonthlySpendPoint[] {
  const byMonth = new Map<string, Omit<MonthlySpendPoint, "key">>();
  const bucketFor = (key: string) => {
    const existing = byMonth.get(key);
    if (existing) return existing;
    const fresh = { total: 0, count: 0, credited: 0, creditCount: 0 };
    byMonth.set(key, fresh);
    return fresh;
  };
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    const bucket = bucketFor(monthKeyOf(inv));
    bucket.total += inv.total_amount;
    bucket.count += 1;
  }
  for (const credit of credits) {
    const bucket = bucketFor(credit.monthKey);
    bucket.total += credit.amount;
    bucket.credited += credit.amount;
    bucket.creditCount += 1;
  }
  const anchor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const series: MonthlySpendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = ymKey(d);
    const bucket = byMonth.get(key);
    series.push({
      key,
      total: bucket?.total ?? 0,
      count: bucket?.count ?? 0,
      credited: bucket?.credited ?? 0,
      creditCount: bucket?.creditCount ?? 0,
    });
  }
  return series;
}

export interface MonthDelta {
  current: MonthlySpendPoint;
  previous: MonthlySpendPoint | null;
  /** Percent change vs previous month, rounded. Null when there's no prior
   * point or it had zero spend (avoids a divide-by-zero / infinite delta). */
  deltaPct: number | null;
}

/** Delta of the last point in a monthly series vs the one before it. */
export function computeMonthDelta(series: MonthlySpendPoint[]): MonthDelta {
  const current = series[series.length - 1];
  const previous = series[series.length - 2] ?? null;
  const deltaPct =
    previous && previous.total > 0
      ? Math.round(((current.total - previous.total) / previous.total) * 100)
      : null;
  return { current, previous, deltaPct };
}

export interface BudgetMetrics {
  /** Bar/percent denominator: the project's credit total when set, else
   * total funds released (the only meaningful "available money" figure when
   * no credit has been recorded). */
  denominator: number;
  usesBudget: boolean;
  /** denominator − spentTotal. Negative when over. */
  left: number;
  /** Rounded percent spent, unclamped (may exceed 100 when over budget). */
  pct: number;
  /** Same percent, clamped 0–100 for a progress-bar width. */
  pctClamped: number;
}

export function computeBudgetMetrics(
  budget: number | null | undefined,
  spentTotal: number,
  fundsReleasedTotal: number
): BudgetMetrics {
  const usesBudget = typeof budget === "number" && budget > 0;
  const denominator = usesBudget ? budget : fundsReleasedTotal;
  const left = denominator - spentTotal;
  const pct = denominator > 0 ? Math.round((spentTotal / denominator) * 100) : 0;
  return { denominator, usesBudget, left, pct, pctClamped: Math.min(Math.max(pct, 0), 100) };
}

export interface PendingRefunds {
  count: number;
  total: number;
}

/** Expenses the BANK still owes back — the second reimbursement channel.
 *
 * refundable_status tracks only the COMPANY channel (it flips to 'refunded'
 * the moment the company settles), so bank-outstanding expenses are invisible
 * to computePendingRefunds. Bank settlement lives solely in refunded_by
 * ('bank' | 'both'); every other value, including NULL on a still-pending row,
 * means still owed.
 *
 * Deliberately NOT gated on isPersonalExpense: a company-reimbursed expense is
 * reassigned to the company purse yet the bank still owes it. This set OVERLAPS
 * computePendingRefunds — the two are separate balances, never parts of a
 * whole, and must not be summed. Same rule as the Expense page's dark card. */
export function computeBankOutstanding(invoices: Invoice[]): PendingRefunds {
  let count = 0;
  let total = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (!inv.refundable_status) continue;
    if (inv.refunded_by === "bank" || inv.refunded_by === "both") continue;
    count += 1;
    total += inv.total_amount;
  }
  return { count, total };
}

/** Personal expenses still awaiting reimbursement (refundable or already
 * requested) — same rule as the Expense page's dark card "Pending refunds" line.
 * Company channel only; see computeBankOutstanding for the bank side. */
export function computePendingRefunds(invoices: Invoice[]): PendingRefunds {
  let count = 0;
  let total = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (!isPersonalExpense(inv)) continue;
    if (inv.refundable_status === "refundable" || inv.refundable_status === "refund_pending") {
      count += 1;
      total += inv.total_amount;
    }
  }
  return { count, total };
}

export interface MoneyPurseView {
  key: "company" | "personal";
  released: number;
  spent: number;
  count: number;
}

interface InvoiceMetaLike {
  fundsReleasedTotal: number;
  fundsReleasedCompanyTotal?: number;
  fundsReleasedPersonalTotal?: number;
  companySpentTotal: number;
  personalSpentTotal?: number;
}

/** Company/personal purse figures — released & spent come from the backend
 * meta (authoritative), counts are derived client-side over the same list. */
export function buildPurseViews(invoices: Invoice[], meta: InvoiceMetaLike): MoneyPurseView[] {
  let companyCount = 0;
  let personalCount = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (isPersonalExpense(inv)) personalCount += 1;
    else companyCount += 1;
  }
  const releasedPersonal = meta.fundsReleasedPersonalTotal ?? 0;
  const releasedCompany = meta.fundsReleasedCompanyTotal ?? meta.fundsReleasedTotal - releasedPersonal;
  return [
    { key: "company", released: releasedCompany, spent: meta.companySpentTotal, count: companyCount },
    {
      key: "personal",
      released: releasedPersonal,
      spent: meta.personalSpentTotal ?? 0,
      count: personalCount,
    },
  ];
}

export interface TypeMonthlyBucket {
  type: ExpenseType;
  /** Length always equals the requested `months`. */
  monthly: MonthlySpendPoint[];
  total: number;
  count: number;
  deltaPct: number | null;
}

/** Per-type 6-month buckets for the "Monthly spend by type" small multiples,
 * each net of the returns attributed to that type. */
export function buildTypeMonthlyBuckets(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date()
): TypeMonthlyBucket[] {
  const credits = buildReturnCredits(invoices);
  return EXPENSE_TYPES.map((type) => {
    const monthly = buildMonthlySpendSeries(
      invoices.filter((i) => i.type === type),
      months,
      referenceDate,
      credits.filter((c) => c.type === type)
    );
    const total = monthly.reduce((s, m) => s + m.total, 0);
    const count = monthly.reduce((s, m) => s + m.count, 0);
    const { deltaPct } = computeMonthDelta(monthly);
    return { type, monthly, total, count, deltaPct };
  });
}

/** Shared bar-height denominator across all type buckets (so the three mini
 * charts sit on one scale) — the largest single-month total, floored at 1 to
 * avoid a divide-by-zero when there's no spend at all yet. */
export function sharedMonthlyMax(buckets: TypeMonthlyBucket[]): number {
  const max = buckets.reduce(
    (m, b) => Math.max(m, ...b.monthly.map((p) => p.total)),
    0
  );
  return max > 0 ? max : 1;
}
