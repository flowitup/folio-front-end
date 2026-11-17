import { describe, it, expect } from "vitest";
import { attentionItems, companyProjectCards, initials, projectStatus } from "../company-overview";
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

  it("makes two-letter initials", () => {
    expect(initials("Nguyễn Văn Ân")).toBe("NÂ");
    expect(initials("Duẩn")).toBe("D");
  });
});
