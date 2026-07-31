/**
 * Pure aggregation helpers for the dashboard "Ledger desk" overview (design
 * Canvas 3a). Framework-free — take plain `Invoice[]`/numbers, return plain
 * data the presentational components render. Kept separate from the
 * components so the money math is unit-testable without mounting React.
 *
 * Expense attribution mirrors `expense-purses-summary.tsx` (the Expense page
 * "Two purses" dataviz): a personally-paid expense the company already
 * reimbursed (status refunded, not by bank) counts as company money, and
 * `released_funds`/`return` rows are excluded from "spend" — released_funds
 * marks money moving into the project (not a purchase) and return rows are
 * credits, not spend.
 */
import type { Invoice, InvoiceType } from "@/types/invoice";

export type ExpenseType = Extract<InvoiceType, "labor" | "materials_services" | "others">;
export const EXPENSE_TYPES: readonly ExpenseType[] = ["labor", "materials_services", "others"];

function isSpendInvoice(inv: Invoice): boolean {
  return inv.type === "labor" || inv.type === "materials_services" || inv.type === "others";
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

/** All-time sum across spend invoices — the same client-side total the
 * Expense page's dark "Total expenses" card shows. */
export function computeSpentTotal(invoices: Invoice[]): number {
  return invoices.filter(isSpendInvoice).reduce((s, i) => s + i.total_amount, 0);
}

export interface MonthlySpendPoint {
  /** "YYYY-MM" */
  key: string;
  total: number;
  count: number;
}

/**
 * Last `months` calendar months ending at `referenceDate`'s month, gap-filled
 * with zero totals so the series is always exactly `months` long. Attributes
 * labor to its `service_month` (payment can lag the work); everything else
 * to `issue_date`.
 */
export function buildMonthlySpendSeries(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date()
): MonthlySpendPoint[] {
  const byMonth = new Map<string, { total: number; count: number }>();
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    const key = monthKeyOf(inv);
    const bucket = byMonth.get(key) ?? { total: 0, count: 0 };
    bucket.total += inv.total_amount;
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  const anchor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const series: MonthlySpendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = ymKey(d);
    const bucket = byMonth.get(key);
    series.push({ key, total: bucket?.total ?? 0, count: bucket?.count ?? 0 });
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

/** Personal expenses still awaiting reimbursement (refundable or already
 * requested) — same rule as the Expense page's dark card "Pending refunds" line. */
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

/** Per-type 6-month buckets for the "Monthly spend by type" small multiples. */
export function buildTypeMonthlyBuckets(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date()
): TypeMonthlyBucket[] {
  return EXPENSE_TYPES.map((type) => {
    const monthly = buildMonthlySpendSeries(
      invoices.filter((i) => i.type === type),
      months,
      referenceDate
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
