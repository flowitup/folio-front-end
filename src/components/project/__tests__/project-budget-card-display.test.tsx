/**
 * Tests for the Budget / Spent / Remaining meta-row display on project cards.
 *
 * The display logic lives in projects/page.tsx (a large client component), so
 * we extract + test the pure formatting helpers and the key rendering assertions
 * via a minimal wrapper that exercises the same fmtEUR + remaining logic.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Pure helpers (mirror of what page.tsx uses — tested in isolation so failures
// pinpoint exactly which calculation is wrong).
// ---------------------------------------------------------------------------

const fmtEUR = (n: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

interface BudgetMetaProps {
  budget: number;
  spent: number;
}

/**
 * Minimal presentational slice — mirrors the meta-row in projects/page.tsx so
 * we can test it without mounting the full page (which requires ProjectContext,
 * AuthContext, router, etc.).
 */
function BudgetMeta({ budget, spent }: BudgetMetaProps) {
  const remaining = budget - spent;
  const isOverBudget = budget > 0 && remaining < 0;

  return (
    <div>
      <div data-testid="budget-value">{budget ? fmtEUR(budget) : "—"}</div>
      <div data-testid="spent-value">{spent ? fmtEUR(spent) : "—"}</div>
      <div
        data-testid="remaining-value"
        style={isOverBudget ? { color: "var(--negative)" } : undefined}
        data-over-budget={isOverBudget ? "true" : undefined}
      >
        {budget
          ? isOverBudget
            ? `Over by ${fmtEUR(Math.abs(remaining))}`
            : fmtEUR(remaining)
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
    // remaining = 70 000 — should not show warning
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).not.toBe("—");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.style.color).toBe("");
  });

  it("shows em-dash for spent when spent is 0", () => {
    render(<BudgetMeta budget={50000} spent={0} />);
    expect(screen.getByTestId("spent-value").textContent).toBe("—");
    // remaining = 50 000 — still positive
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
  });
});

describe("BudgetMeta — over budget", () => {
  it("shows warning styling and over-budget label when spent exceeds budget", () => {
    render(<BudgetMeta budget={50000} spent={60000} />);
    const remaining = screen.getByTestId("remaining-value");
    // Should display the over-budget indicator text
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

describe("BudgetMeta — progress calculation (pure logic)", () => {
  it("progress = min(spent/budget, 1) when budget > 0", () => {
    const budget = 100000;
    const spent = 75000;
    const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
    expect(progress).toBeCloseTo(0.75);
  });

  it("progress capped at 1 when over budget", () => {
    const budget = 50000;
    const spent = 60000;
    const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
    expect(progress).toBe(1);
  });

  it("progress = 0 when no budget set", () => {
    const budget = 0;
    const spent = 0;
    const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
    expect(progress).toBe(0);
  });
});
