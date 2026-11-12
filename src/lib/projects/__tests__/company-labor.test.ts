import { describe, it, expect } from "vitest";
import { companyLabor, laborMonths, type ProjectLaborInput } from "../company-labor";

const w = (id: string, name: string, days: number, cost: number) => ({ worker_id: id, worker_name: name, days_worked: days, total_cost: cost });
const pay = (id: string, name: string, paid: number) => ({ worker_id: id, worker_name: name, paid, invoice_count: 1 });
const bucket = (year: number | null, month: number | null, workers: ReturnType<typeof pay>[], unassigned = 0) => ({
  year,
  month,
  workers,
  unassigned_paid: unassigned,
  unassigned_count: unassigned ? 1 : 0,
  total_paid: workers.reduce((s, x) => s + x.paid, 0) + unassigned,
});
const month = (year: number, m: number, workers: ReturnType<typeof w>[]) => ({
  year,
  month: m,
  workers,
  total_days: workers.reduce((s, x) => s + x.days_worked, 0),
  total_cost: workers.reduce((s, x) => s + x.total_cost, 0),
});

const A: ProjectLaborInput = {
  projectId: "a",
  projectName: "A",
  monthly: { rows: [month(2026, 10, [w("a1", "Ân", 10, 1000), w("a2", "Duẩn", 5, 400)]), month(2026, 9, [w("a1", "Ân", 4, 400)])] },
  payments: { months: [bucket(2026, 10, [pay("a1", "Ân", 1500)], 50), bucket(2026, 9, [pay("a1", "Ân", 100)])] } as never,
};
const B: ProjectLaborInput = {
  projectId: "b",
  projectName: "B",
  monthly: { rows: [month(2026, 10, [w("b1", "ân ", 6, 600)])] },
  payments: { months: [] },
};

describe("company labor", () => {
  it("lists months most recent first", () => {
    expect(laborMonths([A, B])).toEqual(["2026-10", "2026-09"]);
  });

  it("merges one person across projects and settles the month company-wide", () => {
    const r = companyLabor([A, B], "2026-10");
    const an = r.workers.find((x) => x.key === "ân")!;
    expect(an.days).toBe(16);
    expect(an.earned).toBe(1600);
    expect(an.paid).toBe(1500);
    expect(an.owed).toBe(100); // paid on A covers part of B's days
    expect(an.projects.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.totals).toMatchObject({ days: 21, earned: 2000, paid: 1550, owed: 500, unassignedPaid: 50, workerCount: 2 });
  });

  it("keeps the Labor page's per-project rule on project rows", () => {
    const r = companyLabor([A, B], "2026-10");
    expect(r.projects.find((p) => p.id === "a")).toMatchObject({ days: 15, earned: 1400, paid: 1550, owed: 400 });
    expect(r.projects.find((p) => p.id === "b")).toMatchObject({ owed: 600, workerCount: 1 });
  });

  it("each month stands alone over all months", () => {
    const r = companyLabor([A, B], null);
    // Oct: 1600 − 1500 = 100; Sep: 400 − 100 = 300
    expect(r.workers.find((x) => x.key === "ân")!.owed).toBe(400);
  });
});
