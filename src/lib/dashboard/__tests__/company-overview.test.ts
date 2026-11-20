import { describe, it, expect } from "vitest";
import { attentionItems, companyProjectCards, initials, pickerMonths, projectStatus, workerPaid } from "../company-overview";
import { summaryRow } from "@/lib/projects/company-summary";
import type { Project } from "@/types/project";
import type { CompanyLabor } from "@/lib/projects/company-labor";

const p = (id: string, budget: number | null, spent: number | undefined): Project =>
  ({ id, name: id, address: null, owner_id: "o", user_count: 1, created_at: "", budget, spent, spent_invoiced: spent }) as Project;
const name = (x: Project) => x.name;
const labor = (rows: { id: string; owed: number; days: number }[], unassignedPaid = 0): CompanyLabor => ({
  workers: [],
  projects: rows.map((r) => ({ id: r.id, name: r.id, days: r.days, earned: 0, paid: 0, owed: r.owed, workerCount: 1 })),
  totals: { days: 0, earned: 0, paid: 0, owed: 0, unassignedPaid, workerCount: 0 },
});

describe("company overview", () => {
  it("classifies projects by budget use", () => {
    expect(projectStatus(summaryRow(p("a", 100, 120)))).toBe("over");
    expect(projectStatus(summaryRow(p("a", 100, 95)))).toBe("near");
    expect(projectStatus(summaryRow(p("a", 100, 10)))).toBe("ok");
    expect(projectStatus(summaryRow(p("a", null, 10)))).toBe("noBudget");
    expect(projectStatus(summaryRow(p("a", 100, undefined)))).toBe("hidden");
  });

  it("puts overspent and almost-out projects first, then most wages owed", () => {
    const cards = companyProjectCards(
      [p("ok-low", 100, 10), p("over", 100, 130), p("ok-high", 100, 20), p("near", 100, 92)],
      labor([{ id: "ok-high", owed: 500, days: 3 }, { id: "ok-low", owed: 50, days: 1 }]),
      name,
    );
    expect(cards.map((c) => c.row.project.id)).toEqual(["over", "near", "ok-high", "ok-low"]);
    expect(cards[2]).toMatchObject({ days: 3, owed: 500 });
  });

  it("lists what needs attention", () => {
    const cards = companyProjectCards([p("over", 100, 130), p("near", 100, 92), p("ok", 100, 1)], null, name);
    expect(attentionItems(cards, labor([], 300), name)).toEqual([
      { kind: "over", projectId: "over", name: "over", amount: 30, pct: 130 },
      { kind: "near", projectId: "near", name: "near", amount: 8, pct: 92 },
      { kind: "unassignedPay", amount: 300 },
    ]);
  });

  it("flags the month's wages still owed, with the number of workers owed", () => {
    const l: CompanyLabor = {
      workers: [
        { key: "a", name: "A", days: 5, earned: 500, paid: 200, owed: 300, projects: [] },
        { key: "b", name: "B", days: 2, earned: 200, paid: 200, owed: 0, projects: [] },
        { key: "c", name: "C", days: 1, earned: 100, paid: 0, owed: 100, projects: [] },
      ],
      projects: [],
      totals: { days: 8, earned: 800, paid: 400, owed: 400, unassignedPaid: 0, workerCount: 3 },
    };
    expect(attentionItems([], l, name)).toEqual([{ kind: "wagesOwed", amount: 400, workerCount: 2 }]);
    // Nothing owed: no wages item, so "nothing needs attention" can show.
    expect(attentionItems([], labor([]), name)).toEqual([]);
  });

  it("counts as paid only the payments linked to a worker", () => {
    const l = labor([]);
    l.totals.paid = 7885 + 6395;
    l.totals.unassignedPaid = 6395;
    expect(workerPaid(l)).toBe(7885);
  });

  it("offers every month from the first project or labor month to this month, newest first", () => {
    expect(pickerMonths(["2026-11", "2026-10"], ["2026-09", ""], "2026-11")).toEqual(["2026-11", "2026-10", "2026-09"]);
    // Gaps are filled, and the range crosses a year.
    expect(pickerMonths(["2025-11"], [], "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    // No data at all: this month alone.
    expect(pickerMonths([], [], "2026-11")).toEqual(["2026-11"]);
    // A later month with data stays reachable.
    expect(pickerMonths(["2026-12"], [], "2026-11")).toEqual(["2026-12", "2026-11"]);
  });

  it("makes two-letter initials", () => {
    expect(initials("Nguyễn Văn Ân")).toBe("NÂ");
    expect(initials("Duẩn")).toBe("D");
  });
});
