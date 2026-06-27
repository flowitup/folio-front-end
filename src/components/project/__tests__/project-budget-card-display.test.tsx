/**
 * Tests for the Budget / Spent / Remaining meta-row display on project cards.
 *
 * The display math lives in the shared helper `@/lib/projects/budget-display`
 * (fmtEUR + computeBudgetMeta), which projects/page.tsx imports directly — so
 * these tests exercise the REAL functions the page uses and catch drift.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fmtEUR, computeBudgetMeta } from "@/lib/projects/budget-display";

/**
 * Presentational slice that renders exactly via computeBudgetMeta + fmtEUR —
 * the same helper calls page.tsx makes — so a render assertion validates the
 * real display contract without mounting the full page (ProjectContext, router…).
 */
function BudgetMeta({ budget, spent }: { budget: number; spent: number }) {
  const meta = computeBudgetMeta(budget, spent);
  return (
    <div>
      <div data-testid="budget-value">{meta.budget ? fmtEUR(meta.budget) : "—"}</div>
      <div data-testid="spent-value">{meta.spent ? fmtEUR(meta.spent) : "—"}</div>
      <div
        data-testid="remaining-value"
        style={meta.isOverBudget ? { color: "var(--negative)" } : undefined}
        data-over-budget={meta.isOverBudget ? "true" : undefined}
      >
        {meta.budget
          ? meta.isOverBudget
            ? `Over by ${fmtEUR(Math.abs(meta.remaining))}`
            : fmtEUR(meta.remaining)
          : "—"}
      </div>
    </div>
  );
}

describe("BudgetMeta — no budget set", () => {
  it("shows em-dash for budget, spent, and remaining when all are zero", () => {
    render(<BudgetMeta budget={0} spent={0} />);
    expect(screen.getByTestId("budget-value").textContent).toBe("—");
    expect(screen.getByTestId("spent-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").textContent).toBe("—");
  });
});

describe("BudgetMeta — budget set, under budget", () => {
  it("shows formatted EUR for budget, spent, and remaining", () => {
    render(<BudgetMeta budget={100000} spent={30000} />);
    expect(screen.getByTestId("budget-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-value").textContent).not.toBe("—");
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).not.toBe("—");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.style.color).toBe("");
  });

  it("shows em-dash for spent when spent is 0", () => {
    render(<BudgetMeta budget={50000} spent={0} />);
    expect(screen.getByTestId("spent-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").getAttribute("data-over-budget")).toBeNull();
  });
});

describe("BudgetMeta — over budget", () => {
  it("shows warning styling and over-budget label when spent exceeds budget", () => {
    render(<BudgetMeta budget={50000} spent={60000} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).toMatch(/Over by/);
    expect(remaining.getAttribute("data-over-budget")).toBe("true");
    expect(remaining.style.color).toBe("var(--negative)");
  });

  it("budget and spent still display normal formatted values", () => {
    render(<BudgetMeta budget={50000} spent={60000} />);
    expect(screen.getByTestId("budget-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-value").textContent).not.toBe("—");
  });
});

describe("computeBudgetMeta — derived values", () => {
  it("remaining = budget − spent", () => {
    expect(computeBudgetMeta(100000, 30000).remaining).toBe(70000);
    expect(computeBudgetMeta(50000, 60000).remaining).toBe(-10000);
  });

  it("isOverBudget only when budget set and spend exceeds it", () => {
    expect(computeBudgetMeta(0, 0).isOverBudget).toBe(false);
    expect(computeBudgetMeta(100000, 30000).isOverBudget).toBe(false);
    expect(computeBudgetMeta(50000, 60000).isOverBudget).toBe(true);
  });

  it("progress = spent/budget, clamped to [0, 1]", () => {
    expect(computeBudgetMeta(100000, 75000).progress).toBeCloseTo(0.75);
    expect(computeBudgetMeta(50000, 60000).progress).toBe(1); // capped at 1
    expect(computeBudgetMeta(0, 0).progress).toBe(0); // no budget
    expect(computeBudgetMeta(50000, -10000).progress).toBe(0); // negative spend floored at 0
  });
});
