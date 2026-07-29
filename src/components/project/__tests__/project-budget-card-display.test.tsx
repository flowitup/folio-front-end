/**
 * Tests for the Credit total / Spent by credit / Spent personal / Remaining
 * meta-row display on project cards.
 *
 * The display math lives in the shared helper `@/lib/projects/budget-display`
 * (fmtEUR + computeBudgetMeta), which projects/page.tsx imports directly — so
 * these tests exercise the REAL functions the page uses and catch drift.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fmtEUR, computeBudgetMeta, personalSpendRows } from "@/lib/projects/budget-display";

/**
 * Presentational slice that renders exactly via computeBudgetMeta + fmtEUR —
 * the same helper calls page.tsx makes — so a render assertion validates the
 * real display contract without mounting the full page (ProjectContext, router…).
 */
function BudgetMeta({
  creditTotal,
  spentPersonal,
  spentByCredits,
}: {
  creditTotal: number;
  spentPersonal: number;
  spentByCredits: number;
}) {
  const meta = computeBudgetMeta(creditTotal, spentPersonal, spentByCredits);
  return (
    <div>
      <div data-testid="credit-total-value">
        {meta.creditTotal ? fmtEUR(meta.creditTotal) : "—"}
      </div>
      <div data-testid="spent-credits-value">
        {meta.spentByCredits ? fmtEUR(meta.spentByCredits) : "—"}
      </div>
      <div data-testid="spent-personal-value">
        {meta.spentPersonal ? fmtEUR(meta.spentPersonal) : "—"}
      </div>
      <div
        data-testid="remaining-value"
        style={meta.isOverBudget ? { color: "var(--negative)" } : undefined}
        data-over-budget={meta.isOverBudget ? "true" : undefined}
      >
        {meta.creditTotal
          ? meta.isOverBudget
            ? `Over by ${fmtEUR(Math.abs(meta.remaining))}`
            : fmtEUR(meta.remaining)
          : "—"}
      </div>
    </div>
  );
}

describe("BudgetMeta — no credit set", () => {
  it("shows em-dash for every figure when all are zero", () => {
    render(<BudgetMeta creditTotal={0} spentPersonal={0} spentByCredits={0} />);
    expect(screen.getByTestId("credit-total-value").textContent).toBe("—");
    expect(screen.getByTestId("spent-credits-value").textContent).toBe("—");
    expect(screen.getByTestId("spent-personal-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").textContent).toBe("—");
  });
});

describe("BudgetMeta — credit set, under budget", () => {
  it("shows formatted EUR for all four figures", () => {
    render(<BudgetMeta creditTotal={100000} spentPersonal={30000} spentByCredits={20000} />);
    expect(screen.getByTestId("credit-total-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-credits-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-personal-value").textContent).not.toBe("—");
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).not.toBe("—");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.style.color).toBe("");
  });

  it("shows em-dash for credit spend when nothing was drawn from the credit", () => {
    render(<BudgetMeta creditTotal={50000} spentPersonal={0} spentByCredits={0} />);
    expect(screen.getByTestId("spent-credits-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").getAttribute("data-over-budget")).toBeNull();
  });

  it("shows em-dash for personal spend when everything came from the credit", () => {
    render(<BudgetMeta creditTotal={50000} spentPersonal={0} spentByCredits={20000} />);
    expect(screen.getByTestId("spent-personal-value").textContent).toBe("—");
  });
});

describe("BudgetMeta — over budget", () => {
  it("warns only when CREDIT spend exceeds the credit total", () => {
    render(<BudgetMeta creditTotal={50000} spentPersonal={60000} spentByCredits={60000} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).toMatch(/Over by/);
    expect(remaining.getAttribute("data-over-budget")).toBe("true");
    expect(remaining.style.color).toBe("var(--negative)");
  });

  it("does NOT warn when only personal spend exceeds the credit total", () => {
    // 60k spent overall but none of it drawn from the credit line.
    render(<BudgetMeta creditTotal={50000} spentPersonal={60000} spentByCredits={0} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.textContent).not.toMatch(/Over by/);
  });
});

describe("computeBudgetMeta — derived values", () => {
  it("passes personal spend through untouched (the API computes it)", () => {
    expect(computeBudgetMeta(389504, 24576, 41012).spentPersonal).toBe(24576);
  });

  it("remaining = credit total − credit spend, untouched by personal spend", () => {
    expect(computeBudgetMeta(389504, 24576, 41012).remaining).toBe(348492);
    // Far more personal spend, same credit spend → identical remaining.
    expect(computeBudgetMeta(389504, 200000, 41012).remaining).toBe(348492);
  });

  it("personal spend alone never depletes the credit", () => {
    const meta = computeBudgetMeta(100000, 80000, 0);
    expect(meta.remaining).toBe(100000);
    expect(meta.progress).toBe(0);
    expect(meta.isOverBudget).toBe(false);
  });

  it("isOverBudget only when credit set and credit spend exceeds it", () => {
    expect(computeBudgetMeta(0, 0, 0).isOverBudget).toBe(false);
    expect(computeBudgetMeta(100000, 0, 30000).isOverBudget).toBe(false);
    expect(computeBudgetMeta(50000, 0, 60000).isOverBudget).toBe(true);
  });

  it("progress = credit spend / credit total, clamped to [0, 1]", () => {
    expect(computeBudgetMeta(100000, 0, 75000).progress).toBeCloseTo(0.75);
    expect(computeBudgetMeta(50000, 0, 60000).progress).toBe(1);
    expect(computeBudgetMeta(0, 0, 0).progress).toBe(0);
    expect(computeBudgetMeta(50000, 0, -10000).progress).toBe(0);
  });
});

describe("personalSpendRows", () => {
  it("drops zero-valued types so the breakdown lists only real spend", () => {
    const rows = personalSpendRows({ labor: 100, others: 0, materials_services: 50 });
    expect(rows.map((r) => r.type)).toEqual(["labor", "materials_services"]);
  });

  it("orders labor first and refunds last", () => {
    const rows = personalSpendRows({ return: -20, others: 5, labor: 100, materials_services: 50 });
    expect(rows.map((r) => r.type)).toEqual(["labor", "materials_services", "others", "return"]);
  });

  it("keeps an unknown type rather than dropping it, sorted last", () => {
    const rows = personalSpendRows({ future_type: 10, labor: 5 });
    expect(rows.map((r) => r.type)).toEqual(["labor", "future_type"]);
  });

  it("returns an empty list when there is nothing to show", () => {
    expect(personalSpendRows(undefined)).toEqual([]);
    expect(personalSpendRows({})).toEqual([]);
  });
});
