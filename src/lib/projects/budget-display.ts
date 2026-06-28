/**
 * Pure helpers for the project budget meta-row (Budget / Spent / Remaining).
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
  budget: number;
  spent: number;
  /** budget − spent (can be negative when over budget). */
  remaining: number;
  /** True only when a budget is set and spend exceeds it. */
  isOverBudget: boolean;
  /** Spend ratio clamped to [0, 1]; 0 when no budget is set. */
  progress: number;
}

/** Derive the budget meta-row values from a project's budget + spent. */
export function computeBudgetMeta(budget: number, spent: number): BudgetMeta {
  const remaining = budget - spent;
  const isOverBudget = budget > 0 && remaining < 0;
  // Clamp to [0, 1] — guards against negative spend (over-refund) producing a
  // negative bar width as well as over-budget overflow past 100%.
  const progress = budget > 0 ? Math.max(0, Math.min(spent / budget, 1)) : 0;
  return { budget, spent, remaining, isOverBudget, progress };
}
