/**
 * Company-wide roll-up of the projects list, one row per project plus totals.
 *
 * Every figure is read from the same fields the project cards and the Overview
 * use, so a project reads the same here as on its own page:
 *   spent     = spent_invoiced, every expense net of returns, company AND personal money
 *   remaining = credit total − spent (computeBudgetMeta)
 * Money a caller may not see (no `project:view_budget` / spend permission) is
 * absent from the API row; it stays null here and never counts into a total.
 */

import type { Project } from "@/types/project";
import { computeBudgetMeta } from "@/lib/projects/budget-display";

export interface SummaryRow {
  project: Project;
  /** Credit total; null when unset or not visible to the caller. */
  budget: number | null;
  /** Null when the caller cannot see spend. */
  spent: number | null;
  /** Null without a credit total. */
  remaining: number | null;
  /** Share of the credit spent in percent, unclamped; null without a credit total. */
  usedPct: number | null;
  isOver: boolean;
  laborPaid: number | null;
  laborUnpaid: number | null;
  /** Personal purse: paid with personal money, not reimbursed. */
  personal: number | null;
}

export interface SummaryTotals {
  budget: number;
  spent: number;
  /** Credit minus spend over the projects that have a credit total. */
  remaining: number;
  usedPct: number | null;
  laborPaid: number;
  laborUnpaid: number;
  personal: number;
  projectCount: number;
  overBudgetCount: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | null | undefined): number | null => (typeof v === "number" ? v : null);

export function summaryRow(project: Project): SummaryRow {
  const budget = num(project.budget);
  const hasBudget = budget !== null && budget > 0;
  const spendVisible = typeof project.spent === "number";
  const spent = spendVisible ? (num(project.spent_invoiced) ?? project.spent ?? 0) : null;
  const meta =
    hasBudget && spent !== null
      ? computeBudgetMeta(
          budget,
          project.spent_personal ?? 0,
          project.spent_by_credits ?? 0,
          spent,
          project.spent_unassigned ?? 0,
        )
      : null;
  return {
    project,
    budget: hasBudget ? budget : null,
    spent,
    remaining: meta ? meta.remaining : null,
    usedPct: meta ? meta.progressPct : null,
    isOver: meta ? meta.isOverBudget : false,
    laborPaid: spendVisible ? (num(project.labor_paid) ?? 0) : null,
    laborUnpaid: spendVisible ? (num(project.labor_unpaid) ?? 0) : null,
    personal: spendVisible ? (num(project.spent_personal) ?? 0) : null,
  };
}

export function summarize(rows: readonly SummaryRow[]): SummaryTotals {
  let budget = 0;
  let spentOnBudgeted = 0;
  let spent = 0;
  let laborPaid = 0;
  let laborUnpaid = 0;
  let personal = 0;
  let overBudgetCount = 0;
  for (const r of rows) {
    if (r.spent !== null) spent += r.spent;
    if (r.budget !== null && r.spent !== null) {
      budget += r.budget;
      spentOnBudgeted += r.spent;
    }
    laborPaid += r.laborPaid ?? 0;
    laborUnpaid += r.laborUnpaid ?? 0;
    personal += r.personal ?? 0;
    if (r.isOver) overBudgetCount += 1;
  }
  return {
    budget: cents(budget),
    spent: cents(spent),
    remaining: cents(budget - spentOnBudgeted),
    usedPct: budget > 0 ? (spentOnBudgeted / budget) * 100 : null,
    laborPaid: cents(laborPaid),
    laborUnpaid: cents(laborUnpaid),
    personal: cents(personal),
    projectCount: rows.length,
    overBudgetCount,
  };
}
