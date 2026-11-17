/**
 * The company view of the Overview: every project of one company rolled up,
 * plus what needs attention. Pure helpers, so the page stays presentational.
 *
 * Money comes from the projects list (the same fields the project cards use,
 * see lib/projects/company-summary); labor from the per-project labor
 * endpoints (see lib/projects/company-labor). Money is all-time, labor is for
 * the picked month.
 */

import type { Project } from "@/types/project";
import { summaryRow, summarize, type SummaryRow, type SummaryTotals } from "@/lib/projects/company-summary";
import type { CompanyLabor } from "@/lib/projects/company-labor";

/** Share of the budget spent from which a project is flagged "almost out". */
export const NEAR_BUDGET_PCT = 90;

export type ProjectStatus = "over" | "near" | "ok" | "noBudget" | "hidden";

export interface CompanyProjectCard {
  row: SummaryRow;
  status: ProjectStatus;
  /** Days and wages still owed in the picked month (0 when none). */
  days: number;
  owed: number;
}

export type Attention =
  | { kind: "over"; projectId: string; name: string; amount: number; pct: number }
  | { kind: "near"; projectId: string; name: string; amount: number; pct: number }
  | { kind: "unassignedPay"; amount: number };

export function projectStatus(row: SummaryRow): ProjectStatus {
  if (row.spent === null) return "hidden";
  if (row.budget === null || row.usedPct === null) return "noBudget";
  if (row.isOver) return "over";
  if (row.usedPct >= NEAR_BUDGET_PCT) return "near";
  return "ok";
}

const RANK: Record<ProjectStatus, number> = { over: 0, near: 1, ok: 2, noBudget: 3, hidden: 4 };

/**
 * Cards ordered by what needs attention: overspent, almost out, then the rest;
 * within a group, the most wages owed first, then by name.
 */
export function companyProjectCards(
  projects: readonly Project[],
  labor: CompanyLabor | null,
  nameOf: (p: Project) => string,
): CompanyProjectCard[] {
  const byId = new Map((labor?.projects ?? []).map((p) => [p.id, p]));
  return projects
    .map((p) => {
      const row = summaryRow(p);
      const l = byId.get(p.id);
      return { row, status: projectStatus(row), days: l?.days ?? 0, owed: l?.owed ?? 0 };
    })
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        b.owed - a.owed ||
        nameOf(a.row.project).localeCompare(nameOf(b.row.project)),
    );
}

export function companyTotals(cards: readonly CompanyProjectCard[]): SummaryTotals {
  return summarize(cards.map((c) => c.row));
}

export function attentionItems(
  cards: readonly CompanyProjectCard[],
  labor: CompanyLabor | null,
  nameOf: (p: Project) => string,
): Attention[] {
  const items: Attention[] = [];
  for (const c of cards) {
    if (c.status !== "over" && c.status !== "near") continue;
    const remaining = c.row.remaining ?? 0;
    items.push({
      kind: c.status,
      projectId: c.row.project.id,
      name: nameOf(c.row.project),
      amount: Math.abs(remaining),
      pct: Math.round(c.row.usedPct ?? 0),
    });
  }
  if (labor && labor.totals.unassignedPaid > 0) items.push({ kind: "unassignedPay", amount: labor.totals.unassignedPaid });
  return items;
}

/** Two-letter avatar from a person's name: first and last word ("Nguyễn Văn Ân" → "NÂ"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
