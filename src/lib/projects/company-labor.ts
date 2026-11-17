/**
 * Company-wide labor roll-up: worker days, wages earned, paid and still owed,
 * added up over every project of a company.
 *
 * Built from the two per-project endpoints the Labor page already uses
 * (labor-monthly-summary for days and wages, labor-payments-summary for what
 * was paid), so a project's figures here equal its own Labor page.
 *
 * Workers are project rows; the same person on several projects is merged by
 * name. Each month stands alone (owner's rule): an overpayment in one month
 * never settles another. Within a month:
 *   - per worker (company view): owed = max(0, wages on all projects − paid on all projects)
 *   - per project: owed = Σ over its workers of max(0, wages − paid), the Labor page's rule
 * Payments with no worker settle nobody; they count in `paid` and are reported
 * as `unassignedPaid`. Payments with no month count only when no month is picked.
 */

import type { LaborMonthlySummaryResponse, LaborPaymentsSummaryResponse } from "@/types/labor";

export interface ProjectLaborInput {
  projectId: string;
  projectName: string;
  monthly: LaborMonthlySummaryResponse;
  payments: LaborPaymentsSummaryResponse;
}

export interface LaborWorkerRow {
  key: string;
  name: string;
  days: number;
  earned: number;
  paid: number;
  owed: number;
  /** Projects the person worked on in the period, most days first. */
  projects: { id: string; name: string; days: number }[];
}

export interface LaborProjectRow {
  id: string;
  name: string;
  days: number;
  earned: number;
  paid: number;
  owed: number;
  workerCount: number;
}

export interface CompanyLabor {
  workers: LaborWorkerRow[];
  projects: LaborProjectRow[];
  totals: { days: number; earned: number; paid: number; owed: number; unassignedPaid: number; workerCount: number };
}

const cents = (n: number) => Math.round(n * 100) / 100;
const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
export const personKey = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** Months ("YYYY-MM") with attendance or payments on any project, most recent first. */
export function laborMonths(inputs: readonly ProjectLaborInput[]): string[] {
  const set = new Set<string>();
  for (const p of inputs) {
    for (const r of p.monthly.rows) set.add(ymOf(r.year, r.month));
    for (const b of p.payments.months) if (b.year && b.month) set.add(ymOf(b.year, b.month));
  }
  return [...set].sort().reverse();
}

interface Cell {
  cost: number;
  paid: number;
}

/** @param month "YYYY-MM" to keep one month, null for every month. */
export function companyLabor(inputs: readonly ProjectLaborInput[], month: string | null): CompanyLabor {
  const people = new Map<string, { name: string; days: number; earned: number; paid: number; cells: Map<string, Cell>; projects: Map<string, { id: string; name: string; days: number }> }>();
  const person = (name: string) => {
    const key = personKey(name);
    let p = people.get(key);
    if (!p) {
      p = { name: name.trim(), days: 0, earned: 0, paid: 0, cells: new Map(), projects: new Map() };
      people.set(key, p);
    }
    return p;
  };
  const cell = (cells: Map<string, Cell>, k: string) => {
    let c = cells.get(k);
    if (!c) {
      c = { cost: 0, paid: 0 };
      cells.set(k, c);
    }
    return c;
  };

  const projects: LaborProjectRow[] = [];
  let unassignedPaid = 0;

  for (const input of inputs) {
    const row: LaborProjectRow = { id: input.projectId, name: input.projectName, days: 0, earned: 0, paid: 0, owed: 0, workerCount: 0 };
    const projectCells = new Map<string, Cell>(); // `${worker_id}|${ym}`
    const workerIds = new Set<string>();

    for (const m of input.monthly.rows) {
      const ym = ymOf(m.year, m.month);
      if (month && ym !== month) continue;
      for (const w of m.workers) {
        row.days += w.days_worked;
        row.earned += w.total_cost;
        workerIds.add(w.worker_id);
        cell(projectCells, `${w.worker_id}|${ym}`).cost += w.total_cost;
        const p = person(w.worker_name);
        p.days += w.days_worked;
        p.earned += w.total_cost;
        cell(p.cells, ym).cost += w.total_cost;
        if (w.days_worked > 0) {
          const pp = p.projects.get(input.projectId) ?? { id: input.projectId, name: input.projectName, days: 0 };
          pp.days += w.days_worked;
          p.projects.set(input.projectId, pp);
        }
      }
    }

    for (const b of input.payments.months) {
      const ym = b.year && b.month ? ymOf(b.year, b.month) : null;
      if (month && ym !== month) continue;
      row.paid += b.total_paid;
      unassignedPaid += b.unassigned_paid ?? 0;
      for (const w of b.workers) {
        workerIds.add(w.worker_id);
        const p = person(w.worker_name);
        p.paid += w.paid;
        // A payment with no month settles no month.
        if (ym) {
          cell(projectCells, `${w.worker_id}|${ym}`).paid += w.paid;
          cell(p.cells, ym).paid += w.paid;
        }
      }
    }

    for (const c of projectCells.values()) row.owed += Math.max(0, c.cost - c.paid);
    row.workerCount = workerIds.size;
    if (row.days || row.earned || row.paid) {
      projects.push({ ...row, earned: cents(row.earned), paid: cents(row.paid), owed: cents(row.owed) });
    }
  }

  const workers: LaborWorkerRow[] = [];
  for (const [key, p] of people) {
    let owed = 0;
    for (const c of p.cells.values()) owed += Math.max(0, c.cost - c.paid);
    workers.push({
      key,
      name: p.name,
      days: p.days,
      earned: cents(p.earned),
      paid: cents(p.paid),
      owed: cents(owed),
      projects: [...p.projects.values()].sort((a, b) => b.days - a.days),
    });
  }
  workers.sort((a, b) => a.name.localeCompare(b.name));

  return {
    workers,
    projects,
    totals: {
      days: workers.reduce((s, w) => s + w.days, 0),
      earned: cents(workers.reduce((s, w) => s + w.earned, 0)),
      paid: cents(projects.reduce((s, p) => s + p.paid, 0)),
      owed: cents(workers.reduce((s, w) => s + w.owed, 0)),
      unassignedPaid: cents(unassignedPaid),
      workerCount: workers.length,
    },
  };
}
