import { describe, it, expect } from "vitest";
import { summaryRow, summarize } from "../company-summary";
import type { Project } from "@/types/project";

const p = (over: Partial<Project>): Project =>
  ({ id: "x", name: "X", address: null, owner_id: "o", user_count: 1, created_at: "", ...over }) as Project;

describe("company summary", () => {
  it("remaining = credit − every expense (company + personal)", () => {
    const r = summaryRow(p({ budget: 1000, spent: 400, spent_invoiced: 300, spent_by_credits: 200, spent_personal: 100 }));
    expect(r.spent).toBe(300);
    expect(r.remaining).toBe(700);
    expect(r.usedPct).toBe(30);
    expect(r.isOver).toBe(false);
  });

  it("flags an overspent project and totals only budgeted projects for remaining", () => {
    const a = summaryRow(p({ budget: 100, spent: 150, spent_invoiced: 150, labor_paid: 10, labor_unpaid: 5 }));
    const b = summaryRow(p({ budget: null, spent: 50, spent_invoiced: 50, spent_personal: 20 }));
    const t = summarize([a, b]);
    expect(a.isOver).toBe(true);
    expect(t.spent).toBe(200);
    expect(t.budget).toBe(100);
    expect(t.remaining).toBe(-50);
    expect(t.laborPaid).toBe(10);
    expect(t.laborUnpaid).toBe(5);
    expect(t.personal).toBe(20);
    expect(t.overBudgetCount).toBe(1);
  });

  it("keeps money the caller cannot see out of the figures", () => {
    const r = summaryRow(p({}));
    expect(r.spent).toBeNull();
    expect(r.remaining).toBeNull();
    expect(summarize([r]).spent).toBe(0);
  });
});
