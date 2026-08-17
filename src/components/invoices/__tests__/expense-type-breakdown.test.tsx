/**
 * Unit tests for ExpenseTypeBreakdown — the type-first companion to the purse
 * cards.
 *
 * The fixture mirrors a real project (14 Rue Florentin) so the assertions
 * double as a production-parity check: materials & services 46 320,28 company /
 * 9 656,04 personal · labor 3 045 / 10 135 · others 483,99 / 1 449,63, all
 * already net of returns.
 *
 * Covers what the parent's tests cannot reach:
 * - rows ordered by type total, descending
 * - every bar measured against ONE shared scale (the component's whole point)
 * - segment widths proportional to the company/personal split inside a row
 * - an over-refunded (net-negative) category clamps to a 0-width bar
 * - types nobody spent on are dropped; an all-zero breakdown renders nothing
 * - the footer total reconciles with the sum of the rows
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ExpenseTypeBreakdown,
  emptyBreakdown,
  niceAxisMax,
  type ExpenseType,
  type PurseBreakdown,
} from "../expense-type-breakdown";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "en",
}));

/** Build a purse breakdown from per-type (total, count) pairs. */
function breakdown(
  types: Partial<Record<ExpenseType, [total: number, count: number]>>
): PurseBreakdown {
  const b = emptyBreakdown();
  for (const [type, [total, count]] of Object.entries(types) as [
    ExpenseType,
    [number, number],
  ][]) {
    b.types[type] = { total, count };
    b.spent += total;
    b.count += count;
  }
  return b;
}

// Production shape, net of returns.
const COMPANY = breakdown({
  materials_services: [46320.28, 36],
  labor: [3045, 9],
  others: [483.99, 9],
});
const PERSONAL = breakdown({
  materials_services: [9656.04, 38],
  labor: [10135, 17],
  others: [1449.63, 28],
});

/** Rendered width of a segment, as a number of percent. */
function segmentWidth(purse: "company" | "personal", type: ExpenseType): number {
  const el = screen.getByTestId(`type-segment-${purse}-${type}`);
  return Number.parseFloat(el.style.width);
}

describe("ExpenseTypeBreakdown — row ordering", () => {
  it("orders rows by type total, largest first", () => {
    const { container } = render(
      <ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />
    );
    const order = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="type-row-"]')
    ).map((el) => el.dataset.testid);
    expect(order).toEqual([
      "type-row-materials_services", // 55 976,32
      "type-row-labor", //             13 180,00
      "type-row-others", //             1 933,62
    ]);
  });
});

describe("ExpenseTypeBreakdown — shared scale", () => {
  it("measures every row against the rounded axis ceiling", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);

    // 55 976,32 rounds up to a 60 000 axis, so the longest bar deliberately
    // stops short of the track end — that is the cost of a readable axis.
    const ms =
      segmentWidth("company", "materials_services") +
      segmentWidth("personal", "materials_services");
    const labor = segmentWidth("company", "labor") + segmentWidth("personal", "labor");
    const others = segmentWidth("company", "others") + segmentWidth("personal", "others");

    expect(ms).toBeCloseTo((55976.32 / 60000) * 100, 4);
    expect(labor).toBeCloseTo((13180 / 60000) * 100, 4);
    expect(others).toBeCloseTo((1933.62 / 60000) * 100, 4);
    expect(ms).toBeLessThan(100);
  });

  it("keeps the ratios between rows intact — one denominator, whatever it is", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const ms =
      segmentWidth("company", "materials_services") +
      segmentWidth("personal", "materials_services");
    const labor = segmentWidth("company", "labor") + segmentWidth("personal", "labor");
    // The invariant that actually matters: bar lengths are proportional to
    // amounts, regardless of what the shared denominator happens to be.
    expect(labor / ms).toBeCloseTo(13180 / 55976.32, 6);
  });

  it("keeps rows comparable: labor's company segment is shorter than materials' despite a longer personal segment", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    // This is the reading the per-purse mini-bars get wrong.
    expect(segmentWidth("company", "labor")).toBeLessThan(
      segmentWidth("company", "materials_services")
    );
    expect(segmentWidth("personal", "labor")).toBeGreaterThan(
      segmentWidth("personal", "materials_services")
    );
  });
});

describe("ExpenseTypeBreakdown — segment split inside a row", () => {
  it("gives the majority of the bar to whoever paid more", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    // Company paid 82,7 % of materials & services…
    expect(segmentWidth("company", "materials_services")).toBeGreaterThan(
      segmentWidth("personal", "materials_services")
    );
    // …and only 23,1 % of labor.
    expect(segmentWidth("personal", "labor")).toBeGreaterThan(
      segmentWidth("company", "labor")
    );
  });
});

describe("ExpenseTypeBreakdown — returns and negative categories", () => {
  it("plots the netted figure it is handed", () => {
    // 57 735,94 gross − 1 759,62 of returns, as the parent nets it.
    render(
      <ExpenseTypeBreakdown
        company={breakdown({ materials_services: [46320.28, 36] })}
        personal={breakdown({ materials_services: [9656.04, 38] })}
      />
    );
    expect(screen.getByTestId("type-total-materials_services").textContent).not.toContain(
      "57"
    );
    expect(screen.getByTestId("type-breakdown-total").textContent).toContain("55");
  });

  it("clamps an over-refunded category to a zero-width bar", () => {
    render(
      <ExpenseTypeBreakdown
        company={breakdown({ materials_services: [5000, 4], others: [-250, 1] })}
        personal={breakdown({ materials_services: [1000, 2] })}
      />
    );
    // Negative must never render a backwards bar.
    expect(segmentWidth("company", "others")).toBe(0);
    expect(segmentWidth("personal", "others")).toBe(0);
    // The row still appears — the money moved, and the amount says so.
    expect(screen.getByTestId("type-total-others")).toBeTruthy();
  });
});

describe("ExpenseTypeBreakdown — empty states", () => {
  it("renders nothing when no type carries a figure", () => {
    const { container } = render(
      <ExpenseTypeBreakdown company={emptyBreakdown()} personal={emptyBreakdown()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("drops types nobody spent on", () => {
    render(
      <ExpenseTypeBreakdown
        company={breakdown({ labor: [2000, 3] })}
        personal={breakdown({ labor: [1000, 1] })}
      />
    );
    expect(screen.getByTestId("type-row-labor")).toBeTruthy();
    expect(screen.queryByTestId("type-row-others")).toBeNull();
    expect(screen.queryByTestId("type-row-materials_services")).toBeNull();
    // A single type still fills the track.
    expect(segmentWidth("company", "labor") + segmentWidth("personal", "labor")).toBeCloseTo(
      100,
      5
    );
  });
});

describe("ExpenseTypeBreakdown — reconciliation", () => {
  it("footer total equals the sum of both purses' type figures", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const total = COMPANY.spent + PERSONAL.spent; // 71 089,94
    expect(Math.round(total)).toBe(71090);
    // formatEURWhole renders with narrow no-break spaces — compare on digits.
    const rendered = screen
      .getByTestId("type-breakdown-total")
      .textContent!.replace(/[^0-9]/g, "");
    expect(rendered).toContain("71090");
  });
});

describe("niceAxisMax", () => {
  it("rounds a real project's largest type up to a readable ceiling", () => {
    // The case the axis exists for: 55 976,32 → 60 000, i.e. steps of 15 000.
    expect(niceAxisMax(55976.32)).toBe(60000);
  });

  it("always lands at or above the value it has to contain", () => {
    for (const v of [1, 37, 480, 1933.62, 13180, 55976.32, 250000, 1_234_567]) {
      expect(niceAxisMax(v)).toBeGreaterThanOrEqual(v);
    }
  });

  it("divides into four equal steps with no repeating fraction", () => {
    for (const v of [1933.62, 13180, 55976.32, 250000, 1_234_567]) {
      const step = niceAxisMax(v) / 4;
      // A step a reader can hold in their head: at most 3 significant digits.
      expect(Number(step.toPrecision(3))).toBe(step);
    }
  });

  it("leaves an exactly-round value alone rather than jumping a whole step", () => {
    expect(niceAxisMax(60000)).toBe(60000);
    expect(niceAxisMax(3000)).toBe(3000);
  });

  it("returns 0 for nothing to plot", () => {
    expect(niceAxisMax(0)).toBe(0);
    expect(niceAxisMax(-5)).toBe(0);
  });
});

describe("ExpenseTypeBreakdown — axis and shares", () => {
  it("labels five ticks across the shared scale", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const ticks = screen.getByTestId("type-axis");
    const labels = Array.from(ticks.children).map((el) => el.textContent);
    expect(labels).toHaveLength(5);
    // 0 · 15k · 30k · 45k · 60k — the ceiling is the last tick.
    expect(labels[0]).toBe("0");
    expect(labels[4]).toMatch(/60/);
    expect(labels[2]).toMatch(/30/);
  });

  it("states the ceiling in the header so a bar length can be read as an amount", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const header = screen.getByText(/invoices\.summary\.sharedScaleTo/);
    expect(header.textContent).toMatch(/60[^0-9]*000/);
  });

  it("shows each type's share of the total, summing to ~100%", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const share = (type: string) =>
      Number.parseInt(screen.getByTestId(`type-share-${type}`).textContent!, 10);
    expect(share("materials_services")).toBe(79);
    expect(share("labor")).toBe(19);
    expect(share("others")).toBe(3);
    // Rounding can drift a point either way; it must not drift further.
    const sum = share("materials_services") + share("labor") + share("others");
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
  });

  it("counts both purses' invoices under the type name", () => {
    render(<ExpenseTypeBreakdown company={COMPANY} personal={PERSONAL} />);
    const row = screen.getByTestId("type-row-materials_services");
    // 36 company + 38 personal.
    expect(row.textContent).toContain('invoices.invoiceCount({"n":74})');
  });
});
