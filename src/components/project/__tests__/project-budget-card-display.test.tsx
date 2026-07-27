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
import { fmtEUR, computeBudgetMeta } from "@/lib/projects/budget-display";

/**
 * Presentational slice that renders exactly via computeBudgetMeta + fmtEUR —
 * the same helper calls page.tsx makes — so a render assertion validates the
 * real display contract without mounting the full page (ProjectContext, router…).
 */
function BudgetMeta({
  creditTotal,
  spent,
  spentByCredits,
}: {
  creditTotal: number;
  spent: number;
  spentByCredits: number;
}) {
  const meta = computeBudgetMeta(creditTotal, spent, spentByCredits);
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
    render(<BudgetMeta creditTotal={0} spent={0} spentByCredits={0} />);
    expect(screen.getByTestId("credit-total-value").textContent).toBe("—");
    expect(screen.getByTestId("spent-credits-value").textContent).toBe("—");
    expect(screen.getByTestId("spent-personal-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").textContent).toBe("—");
  });
});

describe("BudgetMeta — credit set, under budget", () => {
  it("shows formatted EUR for all four figures", () => {
    render(<BudgetMeta creditTotal={100000} spent={30000} spentByCredits={20000} />);
    expect(screen.getByTestId("credit-total-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-credits-value").textContent).not.toBe("—");
    expect(screen.getByTestId("spent-personal-value").textContent).not.toBe("—");
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).not.toBe("—");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.style.color).toBe("");
  });

  it("shows em-dash for credit spend when nothing was drawn from the credit", () => {
    render(<BudgetMeta creditTotal={50000} spent={0} spentByCredits={0} />);
    expect(screen.getByTestId("spent-credits-value").textContent).toBe("—");
    expect(screen.getByTestId("remaining-value").getAttribute("data-over-budget")).toBeNull();
  });

  it("shows em-dash for personal spend when everything came from the credit", () => {
    render(<BudgetMeta creditTotal={50000} spent={20000} spentByCredits={20000} />);
    expect(screen.getByTestId("spent-personal-value").textContent).toBe("—");
  });
});

describe("BudgetMeta — over budget", () => {
  it("warns only when CREDIT spend exceeds the credit total", () => {
    render(<BudgetMeta creditTotal={50000} spent={60000} spentByCredits={60000} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).toMatch(/Over by/);
    expect(remaining.getAttribute("data-over-budget")).toBe("true");
    expect(remaining.style.color).toBe("var(--negative)");
  });

  it("does NOT warn when only personal spend exceeds the credit total", () => {
    // 60k spent overall but none of it drawn from the credit line.
    render(<BudgetMeta creditTotal={50000} spent={60000} spentByCredits={0} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.getAttribute("data-over-budget")).toBeNull();
    expect(remaining.textContent).not.toMatch(/Over by/);
  });
});

describe("computeBudgetMeta — derived values", () => {
  it("personal = total spend − credit spend", () => {
    expect(computeBudgetMeta(389504, 65588, 41012).spentPersonal).toBe(24576);
  });

  it("remaining = credit total − credit spend, untouched by personal spend", () => {
    expect(computeBudgetMeta(389504, 65588, 41012).remaining).toBe(348492);
    // Same credit spend, far more personal spend → identical remaining.
    expect(computeBudgetMeta(389504, 200000, 41012).remaining).toBe(348492);
  });

  it("personal spend alone never depletes the credit", () => {
    const meta = computeBudgetMeta(100000, 80000, 0);
    expect(meta.remaining).toBe(100000);
    expect(meta.progress).toBe(0);
    expect(meta.isOverBudget).toBe(false);
  });

  it("personal is floored at 0 when the credit figure exceeds the total", () => {
    // Server floors credit spend at 0 after refunds, which can invert the pair.
    expect(computeBudgetMeta(50000, 1000, 5000).spentPersonal).toBe(0);
  });

  it("isOverBudget only when credit set and credit spend exceeds it", () => {
    expect(computeBudgetMeta(0, 0, 0).isOverBudget).toBe(false);
    expect(computeBudgetMeta(100000, 30000, 30000).isOverBudget).toBe(false);
    expect(computeBudgetMeta(50000, 60000, 60000).isOverBudget).toBe(true);
  });

  it("progress = credit spend / credit total, clamped to [0, 1]", () => {
    expect(computeBudgetMeta(100000, 75000, 75000).progress).toBeCloseTo(0.75);
    expect(computeBudgetMeta(50000, 60000, 60000).progress).toBe(1); // capped at 1
    expect(computeBudgetMeta(0, 0, 0).progress).toBe(0); // no credit total
    expect(computeBudgetMeta(50000, -10000, -10000).progress).toBe(0); // negative floored
  });
});
