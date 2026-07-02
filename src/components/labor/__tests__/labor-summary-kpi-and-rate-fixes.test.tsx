/**
 * Regression tests for the Labor summary KPI + rate/role display fixes:
 *  - "On site today" comes from the today-scoped prop, not the filtered
 *    period's worker count (previously 0 in all-history mode).
 *  - "across N workers" uses the distinct worker count in all-history mode.
 *  - Per-worker sub-rows display the current effective rate
 *    (current_daily_rate) so they match the Workers tab after a rate change.
 *  - Month view role column resolves labor.role.label (not the raw
 *    "role" object key) and shows each worker's role name.
 *
 * Separate file: the i18n mock here is param-aware (`key:{json}`) so the
 * interpolated values are assertable, unlike the key-echo mock used by
 * labor-summary.test.tsx.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaborSummary } from "../labor-summary";
import type {
  LaborSummaryResponse,
  LaborMonthlySummaryResponse,
  Worker,
} from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const full = ns ? `${ns.replace(/^labor\.?/, "")}${ns === "labor" ? "" : "."}${key}` : key;
    return params ? `${full}:${JSON.stringify(params)}` : full;
  },
  useLocale: () => "en",
}));

vi.mock("@/lib/api/labor", () => ({
  formatEUR: (value: number) => `€${value.toFixed(2)}`,
}));

vi.mock("../labor-export-dialog", () => ({
  LaborExportDialog: () => null,
}));

function makeWorker(overrides: Partial<Worker> & { id: string }): Worker {
  return {
    project_id: "proj-1",
    name: overrides.id,
    phone: null,
    daily_rate: 100,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const monthlySummary: LaborMonthlySummaryResponse = {
  rows: [
    {
      year: 2026,
      month: 7,
      total_days: 4,
      total_cost: 300,
      workers: [
        { worker_id: "w1", worker_name: "Mành", days_worked: 2, total_cost: 150 },
        { worker_id: "w2", worker_name: "Bảy", days_worked: 2, total_cost: 150 },
      ],
    },
    {
      year: 2026,
      month: 6,
      total_days: 5,
      total_cost: 400,
      workers: [
        { worker_id: "w1", worker_name: "Mành", days_worked: 5, total_cost: 400 },
      ],
    },
  ],
};

const workers: Worker[] = [
  // Base rate 70, current effective rate 75 (scheduled rate change applied).
  makeWorker({ id: "w1", name: "Mành", daily_rate: 70, current_daily_rate: 75 }),
  // No rate change — falls back to the base daily_rate.
  makeWorker({ id: "w2", name: "Bảy", daily_rate: 80 }),
];

const baseProps = {
  projectId: "proj-1",
  summary: null as LaborSummaryResponse | null,
  monthlySummary,
  workers,
  isLoading: false,
  onMonthChange: vi.fn(),
};

describe("LaborSummary — On site today KPI", () => {
  it("displays the today-scoped prop in all-history mode", () => {
    render(<LaborSummary {...baseProps} month="" onSiteToday={3} />);
    const label = screen.getByText("onSiteToday");
    expect(label.parentElement?.textContent).toContain("3");
  });

  it("defaults to 0 when the prop is omitted", () => {
    render(<LaborSummary {...baseProps} month="" />);
    const label = screen.getByText("onSiteToday");
    expect(label.parentElement?.textContent).toContain("0");
  });
});

describe("LaborSummary — across-workers caption", () => {
  it("uses the distinct worker count across visible months in all-history mode", () => {
    render(<LaborSummary {...baseProps} month="" onSiteToday={0} />);
    // w1 appears in two months but must be counted once → n = 2.
    expect(screen.getByText('acrossWorkers:{"n":2}')).toBeInTheDocument();
  });

  it("uses the month summary's row count when a month is selected", () => {
    const summary: LaborSummaryResponse = {
      rows: [
        {
          worker_id: "w1",
          worker_name: "Mành",
          days_worked: 5,
          total_cost: 400,
          banked_hours: 0,
          bonus_full_days: 0,
          bonus_half_days: 0,
          bonus_cost: 0,
        },
      ],
      total_days: 5,
      total_cost: 400,
      total_banked_hours: 0,
      total_bonus_days: 0,
      total_bonus_cost: 0,
    };
    render(
      <LaborSummary {...baseProps} summary={summary} month="2026-06" onSiteToday={0} />,
    );
    expect(screen.getByText('acrossWorkers:{"n":1}')).toBeInTheDocument();
  });
});

describe("LaborSummary — sub-row daily rate", () => {
  it("shows current_daily_rate (falling back to daily_rate) in month sub-rows", () => {
    render(<LaborSummary {...baseProps} month="" onSiteToday={0} />);
    // Mành: current rate 75, NOT the stale base 70.
    expect(
      screen.getAllByText('summaryPerDay:{"rate":"€75.00"}').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('summaryPerDay:{"rate":"€70.00"}')).toBeNull();
    // Bảy: no rate change → base rate 80.
    expect(
      screen.getAllByText('summaryPerDay:{"rate":"€80.00"}').length,
    ).toBeGreaterThan(0);
  });
});

describe("LaborSummary — month view role column", () => {
  const summary: LaborSummaryResponse = {
    rows: [
      {
        worker_id: "w1",
        worker_name: "Mành",
        days_worked: 5,
        total_cost: 400,
        banked_hours: 0,
        bonus_full_days: 0,
        bonus_half_days: 0,
        bonus_cost: 0,
      },
    ],
    total_days: 5,
    total_cost: 400,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  };

  it("resolves the role.label leaf key for the column header", () => {
    render(
      <LaborSummary
        {...baseProps}
        workers={[makeWorker({ id: "w1", name: "Mành", role_name: "Chef d'équipe" })]}
        summary={summary}
        month="2026-06"
        onSiteToday={0}
      />,
    );
    // The header must hit the role.label leaf — rendering the bare "role"
    // key was the raw-object fallback bug ("LABOR.ROLE" on prod).
    expect(screen.getByText("role.label")).toBeInTheDocument();
    // Custom (non-seed) role names render verbatim.
    expect(screen.getByText("Chef d'équipe")).toBeInTheDocument();
  });
});
