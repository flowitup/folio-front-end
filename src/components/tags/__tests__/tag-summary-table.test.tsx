/**
 * Tests for TagSummaryTable component.
 * Covers: rendering summary rows with formatted EUR currency,
 * untagged bucket, grand total row, empty state.
 * Uses fr-FR locale (same as component) to ensure currency formatting matches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagSummaryTable } from "../tag-summary-table";
import type { TagSummaryRow } from "@/lib/api/tags";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      tags: {
        "summary.empty": "No tags with labor or expenses",
        "summary.colTag": "Tag",
        "summary.colLaborCost": "Labor Cost",
        "summary.colExpenses": "Expenses",
        "summary.colTotal": "Total",
        "summary.untagged": "Untagged",
        "summary.grandTotal": "Grand Total",
      },
    };
    return translations[ns]?.[key] || key;
  },
}));

// ---- Helpers ----

// Mirror the shared formatEUR from lib/api/labor (fr-FR, 2 decimal places = cents).
function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function makeRow(
  overrides: Partial<TagSummaryRow> = {}
): TagSummaryRow {
  return {
    tag_id: "tag-1",
    tag_name: "Excavation",
    tag_color: "#ef4444",
    labor_cost: 5000,
    expense_total: 2000,
    labor_entry_count: 10,
    invoice_count: 2,
    ...overrides,
  };
}

// ---- Tests ----

describe("TagSummaryTable — empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty message when rows array is empty", () => {
    render(<TagSummaryTable rows={[]} />);

    expect(screen.getByText("No tags with labor or expenses")).toBeInTheDocument();
  });

  it("does not render table headers when empty", () => {
    render(<TagSummaryTable rows={[]} />);

    expect(screen.queryByText("Tag")).not.toBeInTheDocument();
    expect(screen.queryByText("Labor Cost")).not.toBeInTheDocument();
  });
});

describe("TagSummaryTable — table structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders table with headers when rows provided", () => {
    const rows = [makeRow()];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Tag")).toBeInTheDocument();
    expect(screen.getByText("Labor Cost")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("renders one row per tag summary", () => {
    const rows = [
      makeRow({ tag_id: "tag-1", tag_name: "Excavation" }),
      makeRow({ tag_id: "tag-2", tag_name: "Foundation" }),
    ];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Excavation")).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
  });

  it("renders grand total footer row", () => {
    const rows = [makeRow()];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Grand Total")).toBeInTheDocument();
  });
});

describe("TagSummaryTable — currency formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats labor_cost as EUR with cents (2 decimals)", () => {
    const rows = [
      makeRow({
        labor_cost: 5000,
        expense_total: 0,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const expectedEur = formatEUR(5000);
    expect(container.textContent).toContain(expectedEur);
  });

  it("formats expense_total as EUR with cents (2 decimals)", () => {
    const rows = [
      makeRow({
        labor_cost: 0,
        expense_total: 2500,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const expectedEur = formatEUR(2500);
    expect(container.textContent).toContain(expectedEur);
  });

  it("formats combined total as labor + expense", () => {
    const rows = [
      makeRow({
        labor_cost: 5000,
        expense_total: 2000,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const expectedEur = formatEUR(7000);
    expect(container.textContent).toContain(expectedEur);
  });

  it("formats zero amounts as 0 €", () => {
    const rows = [
      makeRow({
        labor_cost: 0,
        expense_total: 0,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const zeroEur = formatEUR(0);
    expect(container.textContent).toContain(zeroEur);
  });

  it("handles large amounts (100k+)", () => {
    const rows = [
      makeRow({
        labor_cost: 150000,
        expense_total: 50000,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const laborEur = formatEUR(150000);
    const totalEur = formatEUR(200000);
    expect(container.textContent).toContain(laborEur);
    expect(container.textContent).toContain(totalEur);
  });
});

describe("TagSummaryTable — untagged bucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders untagged row when tag_id is null", () => {
    const rows = [
      makeRow({
        tag_id: null,
        tag_name: null,
        tag_color: null,
      }),
    ];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Untagged")).toBeInTheDocument();
  });

  it("renders untagged row alongside tagged rows", () => {
    const rows = [
      makeRow({ tag_id: "tag-1", tag_name: "Excavation" }),
      makeRow({
        tag_id: null,
        tag_name: null,
        tag_color: null,
        labor_cost: 1000,
        expense_total: 500,
      }),
    ];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Excavation")).toBeInTheDocument();
    expect(screen.getByText("Untagged")).toBeInTheDocument();
  });

  it("renders gray circle dot for untagged (not a colored dot)", () => {
    const rows = [
      makeRow({
        tag_id: null,
        tag_name: null,
        tag_color: null,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    // Untagged should have a border (distinguishes it from colored dot)
    const untaggedDot = container.querySelector(
      "span.bg-muted.border"
    );
    expect(untaggedDot).toBeInTheDocument();
  });
});

describe("TagSummaryTable — grand total calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sums all labor costs for grand total", () => {
    const rows = [
      makeRow({ tag_id: "tag-1", labor_cost: 3000, expense_total: 0 }),
      makeRow({ tag_id: "tag-2", labor_cost: 2000, expense_total: 0 }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const grandLaborEur = formatEUR(5000);
    expect(container.textContent).toContain(grandLaborEur);
  });

  it("sums all expense totals for grand total", () => {
    const rows = [
      makeRow({ tag_id: "tag-1", labor_cost: 0, expense_total: 1000 }),
      makeRow({ tag_id: "tag-2", labor_cost: 0, expense_total: 500 }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const grandExpenseEur = formatEUR(1500);
    expect(container.textContent).toContain(grandExpenseEur);
  });

  it("grand total = sum(labor_cost) + sum(expense_total)", () => {
    const rows = [
      makeRow({ tag_id: "tag-1", labor_cost: 3000, expense_total: 500 }),
      makeRow({ tag_id: "tag-2", labor_cost: 2000, expense_total: 1000 }),
      makeRow({
        tag_id: null,
        tag_name: null,
        tag_color: null,
        labor_cost: 1000,
        expense_total: 250,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    // Grand total should be 3000 + 2000 + 1000 (labor) + 500 + 1000 + 250 (expense) = 7750
    const grandTotalEur = formatEUR(7750);
    // Grand total row appears in tfoot
    expect(container.textContent).toContain(grandTotalEur);
  });

  it("grand total footer shows bolded text", () => {
    const rows = [makeRow()];
    const { container } = render(<TagSummaryTable rows={rows} />);

    const footerCells = container.querySelectorAll("tfoot td");
    expect(footerCells.length).toBeGreaterThan(0);
    // Footer cells should have font-bold class
    footerCells.forEach((cell) => {
      if (cell.textContent && cell.textContent.includes("€")) {
        expect(cell.className).toContain("font-bold");
      }
    });
  });
});

describe("TagSummaryTable — tag color dots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders colored dot for tagged row", () => {
    const rows = [
      makeRow({
        tag_id: "tag-1",
        tag_name: "Excavation",
        tag_color: "#ef4444",
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    // Verify the tag name is rendered (which appears next to the dot)
    expect(screen.getByText("Excavation")).toBeInTheDocument();

    // Verify the row element has inline style for backgroundColor
    const tagCell = screen.getByText("Excavation").closest("span");
    const dotSpan = tagCell?.previousElementSibling as HTMLElement | null;
    expect(dotSpan).toBeTruthy();
    // Style should be set on the dot span (previous sibling)
    expect(dotSpan?.style.backgroundColor).toBeTruthy();
  });

  it("uses fallback color when tag_color is null for tagged row (defensive)", () => {
    const rows = [
      makeRow({
        tag_id: "tag-1",
        tag_name: "NoColorTag",
        tag_color: null,
      }),
    ];
    const { container } = render(<TagSummaryTable rows={rows} />);

    // Should render the tag name and have a styled dot
    expect(screen.getByText("NoColorTag")).toBeInTheDocument();

    const tagCell = screen.getByText("NoColorTag").closest("span");
    const dotSpan = tagCell?.previousElementSibling as HTMLElement | null;
    expect(dotSpan).toBeTruthy();
    // Should have fallback color applied
    expect(dotSpan?.style.backgroundColor).toBe("rgb(107, 114, 128)"); // #6b7280 in RGB
  });
});

describe("TagSummaryTable — single row edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders table with only one tagged row", () => {
    const rows = [makeRow()];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Excavation")).toBeInTheDocument();
    expect(screen.getByText("Grand Total")).toBeInTheDocument();
  });

  it("renders table with only untagged row", () => {
    const rows = [
      makeRow({
        tag_id: null,
        tag_name: null,
        tag_color: null,
      }),
    ];
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Untagged")).toBeInTheDocument();
    expect(screen.getByText("Grand Total")).toBeInTheDocument();
  });

  it("handles many rows (10+) without error", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      makeRow({
        tag_id: `tag-${i}`,
        tag_name: `Tag ${i}`,
      })
    );
    render(<TagSummaryTable rows={rows} />);

    expect(screen.getByText("Tag 0")).toBeInTheDocument();
    expect(screen.getByText("Tag 11")).toBeInTheDocument();
  });
});
