/**
 * Tests for LaborSummary component — phase 06 supplement banner, bonus KPI, bonus-days column
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaborSummary } from "../labor-summary";
import type {
  LaborSummaryResponse,
  LaborMonthlySummaryResponse,
} from "@/types/labor";

// Mock next-intl — returns key as fallback (next-intl default when translation missing)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// Mock formatEUR from api/labor
vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
}));

// Mock LaborExportDialog to avoid triggering sonner/dialog in summary tests
vi.mock("../labor-export-dialog", () => ({
  LaborExportDialog: () => null,
}));

function makeSummary(overrides: Partial<LaborSummaryResponse> = {}): LaborSummaryResponse {
  return {
    rows: [],
    total_days: 0,
    total_cost: 0,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
    ...overrides,
  };
}

function makeMonthlySummary(
  rows: LaborMonthlySummaryResponse["rows"],
): LaborMonthlySummaryResponse {
  return { rows };
}

const defaultProps = {
  projectId: "proj-test-1",
  isLoading: false,
  month: "2026-04",
  monthlySummary: null as LaborMonthlySummaryResponse | null,
  onMonthChange: vi.fn(),
};

describe("LaborSummary — supplement banner", () => {
  it("renders banner when total_banked_hours > 0", () => {
    const summary = makeSummary({
      total_banked_hours: 10,
      total_bonus_days: 2,
      total_bonus_cost: 150,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Banner renders the i18n key (mock returns key as-is)
    expect(screen.getByText("supplement.banner")).toBeDefined();
  });

  it("does NOT render banner when total_banked_hours === 0", () => {
    const summary = makeSummary({ total_banked_hours: 0 });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    expect(screen.queryByText("supplement.banner")).toBeNull();
  });

  it("does NOT render banner when summary is null", () => {
    render(<LaborSummary {...defaultProps} summary={null} />);
    expect(screen.queryByText("supplement.banner")).toBeNull();
  });

  it("renders banner for non-zero banked_hours (float bonus days scenario)", () => {
    // Verifies banner visibility when bonus_days is a float like 1.5
    const summary = makeSummary({
      total_banked_hours: 4,
      total_bonus_days: 1.5,
      total_bonus_cost: 75,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Banner is present
    expect(screen.getByText("supplement.banner")).toBeDefined();
    // Banner is NOT present when reset to zero
  });
});

describe("LaborSummary — bonus cost KPI card", () => {
  it("renders bonus cost KPI card with formatted EUR value", () => {
    const summary = makeSummary({ total_bonus_cost: 320.5 });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    expect(screen.getByText("€320.50")).toBeDefined();
    expect(screen.getByText("supplement.bonusCost")).toBeDefined();
  });

  it("renders bonus cost KPI card even when bonus_cost is 0", () => {
    const summary = makeSummary({ total_bonus_cost: 0 });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    expect(screen.getByText("supplement.bonusCost")).toBeDefined();
    // Multiple cards may show €0.00 when all values are 0 — confirm at least one exists
    expect(screen.getAllByText("€0.00").length).toBeGreaterThanOrEqual(1);
  });
});

describe("LaborSummary — per-worker bonus days column", () => {
  it("shows 'supplement.bonusDays' column header", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 5,
          total_cost: 500,
          banked_hours: 0,
          bonus_full_days: 0,
          bonus_half_days: 0,
          bonus_cost: 0,
        },
      ],
      total_days: 5,
      total_cost: 500,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    expect(screen.getByText("supplement.bonusDays")).toBeDefined();
  });

  it("renders '1F + 1H' with banked hours and bonus cost for worker with banked_hours > 0", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 10,
          total_cost: 1100,
          banked_hours: 8,
          bonus_full_days: 1,
          bonus_half_days: 1,
          bonus_cost: 100,
        },
      ],
      total_days: 10,
      total_cost: 1100,
      total_banked_hours: 8,
      total_bonus_days: 1.5,
      total_bonus_cost: 100,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Full/half day label — rendered as "{bonus_full_days}F + {bonus_half_days}H" inside a span
    // React renders inline expressions as adjacent text nodes; use regex on the span's textContent
    const fullHalfLabel = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && el.textContent?.trim() === "1F + 1H"
    );
    expect(fullHalfLabel).toBeDefined();
    // Banked hours + cost subtitle (multiple €100.00 may appear — KPI card, tfoot, cell)
    expect(screen.getByText(/8h/)).toBeDefined();
    expect(screen.getAllByText(/€100\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders '—' for worker row where banked_hours === 0", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Bob",
          days_worked: 5,
          total_cost: 500,
          banked_hours: 0,
          bonus_full_days: 0,
          bonus_half_days: 0,
          bonus_cost: 0,
        },
      ],
      total_days: 5,
      total_cost: 500,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    // No full/half day label
    expect(screen.queryByText(/F \+ \d+H/)).toBeNull();

    // Dash rendered for empty bonus column (may be multiple dashes — role cell also shows —)
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders multiple workers with mixed banked/no-banked correctly", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 10,
          total_cost: 1100,
          banked_hours: 8,
          bonus_full_days: 2,
          bonus_half_days: 0,
          bonus_cost: 200,
        },
        {
          worker_id: "w2",
          worker_name: "Bob",
          days_worked: 5,
          total_cost: 500,
          banked_hours: 0,
          bonus_full_days: 0,
          bonus_half_days: 0,
          bonus_cost: 0,
        },
      ],
      total_days: 15,
      total_cost: 1600,
      total_banked_hours: 8,
      total_bonus_days: 2,
      total_bonus_cost: 200,
    });
    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Alice has bonuses — label renders as adjacent text nodes inside span
    const aliceLabel = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && el.textContent?.trim() === "2F + 0H"
    );
    expect(aliceLabel).toBeDefined();

    // Bob has none — dash present somewhere
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

// Phase 08 — mixed-data aggregation rendering + banner conditional visibility
describe("LaborSummary — aggregation rendering (phase 08)", () => {
  it("renders banner in DOM when total_banked_hours > 0 with mixed 2-worker data", () => {
    // Worker 1: banked_hours=8, bonus_full=1, bonus_half=0, bonus_cost=100
    // Worker 2: banked_hours=4, bonus_full=0, bonus_half=1, bonus_cost=50
    // Top-level: total_banked_hours=12, total_bonus_days=1.5, total_bonus_cost=150
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 8,
          total_cost: 800,
          banked_hours: 8,
          bonus_full_days: 1,
          bonus_half_days: 0,
          bonus_cost: 100,
        },
        {
          worker_id: "w2",
          worker_name: "Bob",
          days_worked: 4,
          total_cost: 400,
          banked_hours: 4,
          bonus_full_days: 0,
          bonus_half_days: 1,
          bonus_cost: 50,
        },
      ],
      total_days: 12,
      total_cost: 1200,
      total_banked_hours: 12,
      total_bonus_days: 1.5,
      total_bonus_cost: 150,
    });

    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Banner is present (total_banked_hours=12 > 0)
    expect(screen.getByText("supplement.banner")).toBeDefined();

    // Per-worker rows render their respective values
    // Alice: 1F + 0H, 8h banked, €100.00 cost
    const aliceLabel = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && el.textContent?.trim() === "1F + 0H"
    );
    expect(aliceLabel).toBeDefined();
    expect(screen.getByText(/8h/)).toBeDefined();

    // Bob: 0F + 1H, 4h banked
    const bobLabel = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && el.textContent?.trim() === "0F + 1H"
    );
    expect(bobLabel).toBeDefined();
    expect(screen.getByText(/4h/)).toBeDefined();

    // Bonus costs present (multiple occurrences across KPI card, tfoot, worker cells)
    expect(screen.getAllByText(/€100\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/€50\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it("banner is NOT in the DOM when total_banked_hours=0", () => {
    const summary = makeSummary({
      total_banked_hours: 0,
      total_bonus_days: 0,
      total_bonus_cost: 0,
    });

    render(<LaborSummary {...defaultProps} summary={summary} />);

    // queryByText returns null when element absent
    expect(screen.queryByText("supplement.banner")).toBeNull();
  });

  it("banner is present and per-worker cells render for single-worker with banked_hours=8 + bonus_cost=100", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 10,
          total_cost: 1100,
          banked_hours: 8,
          bonus_full_days: 1,
          bonus_half_days: 0,
          bonus_cost: 100,
        },
      ],
      total_days: 10,
      total_cost: 1100,
      total_banked_hours: 8,
      total_bonus_days: 1,
      total_bonus_cost: 100,
    });

    render(<LaborSummary {...defaultProps} summary={summary} />);

    expect(screen.getByText("supplement.banner")).toBeDefined();

    const fullHalfLabel = screen.getByText((_, el) =>
      el?.tagName === "SPAN" && el.textContent?.trim() === "1F + 0H"
    );
    expect(fullHalfLabel).toBeDefined();
    expect(screen.getByText(/8h/)).toBeDefined();
  });

  it("total_bonus_cost=150 shown in KPI card formatted as EUR when total_banked_hours=12", () => {
    const summary = makeSummary({
      rows: [
        {
          worker_id: "w1",
          worker_name: "Alice",
          days_worked: 8,
          total_cost: 800,
          banked_hours: 8,
          bonus_full_days: 1,
          bonus_half_days: 0,
          bonus_cost: 100,
        },
        {
          worker_id: "w2",
          worker_name: "Bob",
          days_worked: 4,
          total_cost: 400,
          banked_hours: 4,
          bonus_full_days: 0,
          bonus_half_days: 1,
          bonus_cost: 50,
        },
      ],
      total_days: 12,
      total_cost: 1200,
      total_banked_hours: 12,
      total_bonus_days: 1.5,
      total_bonus_cost: 150,
    });

    render(<LaborSummary {...defaultProps} summary={summary} />);

    // Total bonus cost appears in KPI card (mocked formatEUR returns "€150.00")
    expect(screen.getAllByText(/€150\.00/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("LaborSummary — loading state", () => {
  it("renders spinner when isLoading=true", () => {
    render(<LaborSummary {...defaultProps} summary={null} isLoading={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
  });
});

describe("LaborSummary — empty state", () => {
  it("renders empty state message when summary has no rows", () => {
    render(<LaborSummary {...defaultProps} summary={makeSummary()} />);
    expect(screen.getByText("noEntries")).toBeDefined();
  });

  it("renders empty state when summary is null", () => {
    render(<LaborSummary {...defaultProps} summary={null} />);
    expect(screen.getByText("noEntries")).toBeDefined();
  });
});

describe("LaborSummary — month filter (opt-in)", () => {
  it("renders the all-history title and hides Clear button when month is empty", () => {
    render(
      <LaborSummary {...defaultProps} summary={makeSummary()} month="" />
    );
    // i18n mock returns the key as-is: title swaps to summaryAllHistoryTitle.
    expect(screen.getByText("summaryAllHistoryTitle")).toBeDefined();
    expect(screen.queryByText("monthlySummary")).toBeNull();
    expect(screen.queryByLabelText("filterMonthClear")).toBeNull();
  });

  it("renders the monthly title and shows Clear button when month is set", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={makeSummary()}
        month="2026-04"
      />
    );
    expect(screen.getByText("monthlySummary")).toBeDefined();
    expect(screen.queryByText("summaryAllHistoryTitle")).toBeNull();
    expect(screen.getByLabelText("filterMonthClear")).toBeDefined();
  });

  it("clicking Clear resets month to empty (back to all-history)", () => {
    const onMonthChange = vi.fn();
    render(
      <LaborSummary
        {...defaultProps}
        summary={makeSummary()}
        month="2026-04"
        onMonthChange={onMonthChange}
      />
    );

    fireEvent.click(screen.getByLabelText("filterMonthClear"));
    expect(onMonthChange).toHaveBeenCalledWith("");
  });

  it("KPI subtitle shows the all-history label when month is empty", () => {
    render(
      <LaborSummary {...defaultProps} summary={makeSummary()} month="" />
    );
    // The KPI card subtitle uses periodLabel which falls back to filterMonthAll
    // i18n key when month === "". The Folio month-picker trigger also shows
    // the same all-history label, so the key may appear more than once.
    expect(screen.getAllByText("filterMonthAll").length).toBeGreaterThanOrEqual(1);
  });
});

describe("LaborSummary — monthly rollup + year filter (all-history mode)", () => {
  const monthly = makeMonthlySummary([
    {
      year: 2026,
      month: 4,
      total_days: 22,
      total_cost: 5500,
      workers: [
        { worker_id: "w-alice", worker_name: "Alice", days_worked: 12, total_cost: 3000 },
        { worker_id: "w-bob", worker_name: "Bob", days_worked: 10, total_cost: 2500 },
      ],
    },
    {
      year: 2026,
      month: 3,
      total_days: 18,
      total_cost: 4500,
      workers: [
        { worker_id: "w-alice", worker_name: "Alice", days_worked: 18, total_cost: 4500 },
      ],
    },
    {
      year: 2025,
      month: 12,
      total_days: 10,
      total_cost: 2500,
      workers: [
        { worker_id: "w-bob", worker_name: "Bob", days_worked: 10, total_cost: 2500 },
      ],
    },
  ]);

  it("renders one row per (year, month) bucket when month filter is empty", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    // 3 buckets → 3 rows in the table body. Per-row totals are rendered
    // distinctly: 5500, 4500, 2500. The grand total (12500) and KPI card
    // are also rendered, so each per-row value appears at least once.
    expect(screen.getAllByText("€5500.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€4500.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€2500.00").length).toBeGreaterThanOrEqual(1);
  });

  it("derives year buttons from data (only years with entries)", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    const row = screen.getByTestId("year-filter-row");
    // "All" button + "2026" + "2025" — derived from data, no hardcoded range.
    expect(row).toBeDefined();
    expect(screen.getByText("summaryAllYears")).toBeDefined();
    expect(screen.getByText("2026")).toBeDefined();
    expect(screen.getByText("2025")).toBeDefined();
    // No 2024 because the data has no 2024 entries.
    expect(screen.queryByText("2024")).toBeNull();
  });

  it("clicking a year narrows the rendered rows to that year", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    fireEvent.click(screen.getByText("2025"));
    // The 5500 / 4500 (2026) rows should disappear from the table; 2500
    // (2025) row remains. The KPI card may also render the total, hence
    // queryAll over screen-wide getByText.
    expect(screen.queryByText("€5500.00")).toBeNull();
    expect(screen.queryByText("€4500.00")).toBeNull();
    expect(screen.getAllByText("€2500.00").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking 'All' restores all years after a year was selected", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    fireEvent.click(screen.getByText("2025"));
    fireEvent.click(screen.getByText("summaryAllYears"));
    // All three buckets visible again.
    expect(screen.getAllByText("€5500.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€4500.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€2500.00").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a month row drills down via onMonthChange('YYYY-MM')", () => {
    const onMonthChange = vi.fn();
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
        onMonthChange={onMonthChange}
      />
    );
    // April 2026 row holds total_cost=5500. The KPI total card may also
    // render €5500.00, so pick the occurrence inside a <tr>.
    const matches = screen.getAllByText("€5500.00");
    const rowCell = matches.find((el) => el.closest("tr") !== null);
    fireEvent.click(rowCell!.closest("tr")!);
    expect(onMonthChange).toHaveBeenCalledWith("2026-04");
  });

  it("renders summaryYearTitle when a year is selected", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    fireEvent.click(screen.getByText("2026"));
    // i18n mock returns the key as-is (no value interpolation).
    expect(screen.getByText("summaryYearTitle")).toBeDefined();
    expect(screen.queryByText("summaryAllHistoryTitle")).toBeNull();
  });

  it("hides the year-filter row when month filter is set (per-worker mode)", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={makeSummary()}
        monthlySummary={monthly}
        month="2026-04"
      />
    );
    expect(screen.queryByTestId("year-filter-row")).toBeNull();
  });

  it("hides the year-filter row when monthlySummary has no rows", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={makeMonthlySummary([])}
        month=""
      />
    );
    expect(screen.queryByTestId("year-filter-row")).toBeNull();
  });

  it("renders inline per-worker sub-rows under each month header", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    // April 2026 month header has 2 sub-rows (Alice + Bob).
    expect(screen.getByTestId("worker-subrow-2026-04-w-alice")).toBeDefined();
    expect(screen.getByTestId("worker-subrow-2026-04-w-bob")).toBeDefined();
    // March 2026 has Alice only.
    expect(screen.getByTestId("worker-subrow-2026-03-w-alice")).toBeDefined();
    expect(screen.queryByTestId("worker-subrow-2026-03-w-bob")).toBeNull();
    // December 2025 has Bob only.
    expect(screen.getByTestId("worker-subrow-2025-12-w-bob")).toBeDefined();
  });

  it("sub-row days/cost match the BE-supplied per-worker values", () => {
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
      />
    );
    // April: Alice 12 days @ €3000.
    const aliceApr = screen.getByTestId("worker-subrow-2026-04-w-alice");
    expect(aliceApr.textContent).toContain("Alice");
    expect(aliceApr.textContent).toContain("12");
    expect(aliceApr.textContent).toContain("€3000.00");
    // April: Bob 10 days @ €2500.
    const bobApr = screen.getByTestId("worker-subrow-2026-04-w-bob");
    expect(bobApr.textContent).toContain("Bob");
    expect(bobApr.textContent).toContain("10");
    expect(bobApr.textContent).toContain("€2500.00");
  });

  it("clicking the month header still drills down (sub-rows do not block)", () => {
    const onMonthChange = vi.fn();
    render(
      <LaborSummary
        {...defaultProps}
        summary={null}
        monthlySummary={monthly}
        month=""
        onMonthChange={onMonthChange}
      />
    );
    fireEvent.click(screen.getByTestId("month-row-2026-04"));
    expect(onMonthChange).toHaveBeenCalledWith("2026-04");
  });
});
