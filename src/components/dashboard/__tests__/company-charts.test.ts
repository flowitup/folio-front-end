import { describe, expect, it } from "vitest";

import { lastMonths, laborSeries } from "../company-charts";
import type { ProjectLaborInput } from "@/lib/projects/company-labor";

describe("company charts helpers", () => {
  it("lists the last months across a year boundary, oldest first", () => {
    expect(lastMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("adds up days, wages earned and wages paid per month over the projects", () => {
    const input = (id: string, days: number, cost: number, paid: number): ProjectLaborInput =>
      ({
        projectId: id,
        projectName: id,
        monthly: { rows: [{ year: 2026, month: 10, total_days: days, total_cost: cost, workers: [{ worker_id: "w", worker_name: "Thụ", days_worked: days, total_cost: cost }] }] },
        payments: { months: [{ year: 2026, month: 10, total_paid: paid, workers: [{ worker_id: "w", worker_name: "Thụ", paid, invoice_count: 1 }], unassigned_paid: 0, unassigned_count: 0 }] },
      }) as unknown as ProjectLaborInput;
    const series = laborSeries([input("a", 5, 500, 200), input("b", 3, 300, 0)], ["2026-09", "2026-10"]);
    expect(series[0]).toEqual({ key: "2026-09", days: 0, earned: 0, paid: 0 });
    expect(series[1].days).toBe(8);
    expect(series[1].earned).toBe(800);
    expect(series[1].paid).toBe(200);
  });
});
