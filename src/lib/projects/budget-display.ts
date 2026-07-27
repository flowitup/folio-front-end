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
  spentTotal: number,
  spentByCredits: number,
): BudgetMeta {
  // Clamped: the credit figure is floored at 0 server-side (company refunds can
  // exceed company spend), which would otherwise push the remainder negative.
  const spentPersonal = Math.max(spentTotal - spentByCredits, 0);
  const remaining = creditTotal - spentByCredits;
  const isOverBudget = creditTotal > 0 && remaining < 0;
  // Clamp to [0, 1] — guards against negative spend (over-refund) producing a
  // negative bar width as well as over-budget overflow past 100%.
  const progress =
    creditTotal > 0 ? Math.max(0, Math.min(spentByCredits / creditTotal, 1)) : 0;
  return { creditTotal, spentByCredits, spentPersonal, remaining, isOverBudget, progress };
}
