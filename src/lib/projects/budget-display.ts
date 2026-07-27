/**
 * Pure helpers for the project credit meta-row
 * (Credit total / Spent by credit / Spent personal / Remaining).
 *
 * Extracted from projects/page.tsx so the display logic is unit-testable in
 * isolation — the page component imports these, so tests against them catch
 * real drift instead of mirroring the math.
 */

/** Format a number as whole-euro currency (fr-FR, no decimals). */
export function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export interface BudgetMeta {
  /** Total credit available. The API still calls this field `budget`. */
  creditTotal: number;
  /** Spend funded from the credit line (money paid by the company). */
  spentByCredits: number;
  /** Out-of-pocket spend: everything else, including all labor. Never negative. */
  spentPersonal: number;
  /**
   * creditTotal − spentByCredits. Personal money is not drawn from the credit,
   * so it never moves this figure. Goes negative when the credit is overspent.
   */
  remaining: number;
  /** True only when a credit total is set and credit spend exceeds it. */
  isOverBudget: boolean;
  /** Credit drawdown ratio, clamped to [0, 1]; 0 when no credit total is set. */
  progress: number;
}

/** Derive the credit meta-row values from a project's credit total and spend split. */
export function computeBudgetMeta(
  creditTotal: number,
  spentPersonal: number,
  spentByCredits: number,
): BudgetMeta {
  const remaining = creditTotal - spentByCredits;
  const isOverBudget = creditTotal > 0 && remaining < 0;
  // Clamp to [0, 1] — guards against negative spend (over-refund) producing a
  // negative bar width as well as over-budget overflow past 100%.
  const progress =
    creditTotal > 0 ? Math.max(0, Math.min(spentByCredits / creditTotal, 1)) : 0;
  return { creditTotal, spentByCredits, spentPersonal, remaining, isOverBudget, progress };
}

/** One row of the personal-spend breakdown. */
export interface PersonalSpendRow {
  /** Invoice type key — also the i18n key suffix. */
  type: string;
  amount: number;
}

/**
 * Order the personal breakdown for display: labor first (it carries the paid/unpaid
 * split users look for), then the remaining types by size, refunds last since they
 * are credits back rather than spend.
 */
const TYPE_ORDER = ["labor", "materials_services", "others", "refund"];

export function personalSpendRows(byType: Record<string, number> | undefined): PersonalSpendRow[] {
  const entries = Object.entries(byType ?? {}).filter(([, amount]) => amount !== 0);
  return entries
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a.type);
      const ib = TYPE_ORDER.indexOf(b.type);
      // Unknown types (a new invoice type shipped before this list is updated) sort last
      // rather than disappearing.
      return (ia === -1 ? TYPE_ORDER.length : ia) - (ib === -1 ? TYPE_ORDER.length : ib);
    });
}
