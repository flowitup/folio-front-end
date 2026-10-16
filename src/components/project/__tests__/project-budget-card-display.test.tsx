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
  it("warns when spend exceeds the credit total", () => {
    render(<BudgetMeta creditTotal={50000} spentPersonal={60000} spentByCredits={60000} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.textContent).toMatch(/Over by/);
    expect(remaining.getAttribute("data-over-budget")).toBe("true");
    expect(remaining.style.color).toBe("var(--negative)");
  });

  it("warns when personal spend alone exceeds the credit total, as the Overview does", () => {
    // The owner's definition (#336): the credit minus every expense.
    render(<BudgetMeta creditTotal={50000} spentPersonal={60000} spentByCredits={0} />);
    const remaining = screen.getByTestId("remaining-value");
    expect(remaining.getAttribute("data-over-budget")).toBe("true");
    expect(plain(remaining.textContent)).toBe("Over by 10 000 €");
  });

  it("names a sub-euro overrun to the cent, never 'Over by 0 €'", () => {
    render(<BudgetMeta creditTotal={100} spentPersonal={0} spentByCredits={100.4} />);
    expect(plain(screen.getByTestId("remaining-value").textContent)).toBe("Over by 0,40 €");
  });
});

/** Intl's fr-FR output uses no-break spaces; compare with plain ones. */
const plain = (s: string | null) => (s ?? "").replace(/\s/g, " ");

describe("fmtEUR", () => {
  it("keeps whole euros without decimals", () => {
    expect(plain(fmtEUR(12500))).toBe("12 500 €");
    expect(plain(fmtEUR(0))).toBe("0 €");
  });

  it("shows cents when the amount has any", () => {
    expect(plain(fmtEUR(12500.75))).toBe("12 500,75 €");
    expect(plain(fmtEUR(1000.5))).toBe("1 000,50 €");
    expect(plain(fmtEUR(0.4))).toBe("0,40 €");
    expect(plain(fmtEUR(-20.1))).toBe("-20,10 €");
  });

  it("keeps the remaining figure consistent with the figures it is computed from", () => {
    // 1 000,50 − 100,40 used to read "1 001 € − 100 € = 900 €".
    const meta = computeBudgetMeta(1000.5, 0, 100.4);
    expect(plain(fmtEUR(meta.remaining))).toBe("900,10 €");
  });
});

describe("computeBudgetMeta — derived values", () => {
  it("passes personal spend through untouched (the API computes it)", () => {
    expect(computeBudgetMeta(389504, 24576, 41012).spentPersonal).toBe(24576);
  });

  it("remaining = credit total − every expense, the Overview's 'Reste à dépenser'", () => {
    expect(computeBudgetMeta(389504, 24576, 41012).remaining).toBe(323916);
    // QA fixture: 150 000,50 € credit, 4 199,40 € spent in all (3 433,78 company,
    // 366,12 personal, 399,50 in no purse) → 145 801,10 €, never 146 566,72 €.
    const meta = computeBudgetMeta(150000.5, 366.12, 3433.78, 4199.4, 399.5);
    expect(meta.remaining).toBe(145801.1);
    expect(plain(fmtEUR(meta.remaining))).toBe("145 801,10 €");
    expect(meta.spentUnassigned).toBe(399.5);
  });

  it("personal spend draws on the credit too", () => {
    const meta = computeBudgetMeta(100000, 80000, 0);
    expect(meta.remaining).toBe(20000);
    expect(meta.progress).toBeCloseTo(0.8);
    expect(meta.isOverBudget).toBe(false);
  });

  it("isOverBudget only when credit set and spend exceeds it", () => {
    expect(computeBudgetMeta(0, 0, 0).isOverBudget).toBe(false);
    expect(computeBudgetMeta(100000, 0, 30000).isOverBudget).toBe(false);
    expect(computeBudgetMeta(50000, 0, 60000).isOverBudget).toBe(true);
  });

  it("progress = spend / credit total, clamped to [0, 1]; progressPct unclamped", () => {
    expect(computeBudgetMeta(100000, 0, 75000).progress).toBeCloseTo(0.75);
    expect(computeBudgetMeta(50000, 0, 60000).progressPct).toBeCloseTo(120);
    expect(computeBudgetMeta(150000.5, 0, 0, 555).progressPct).toBeCloseTo(0.37, 2);
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
