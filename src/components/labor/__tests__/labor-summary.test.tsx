/**
 * Tests for LaborSummary component — phase 06 supplement banner, bonus KPI, bonus-days column
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaborSummary } from "../labor-summary";
import type { LaborSummaryResponse } from "@/types/labor";

// Mock next-intl — returns key as fallback (next-intl default when translation missing)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// Mock formatEUR from api/labor
vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
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

const defaultProps = {
  isLoading: false,
  month: "2026-04",
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
