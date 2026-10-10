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

describe("LaborSummary — sub-row rate of that month (API month rates)", () => {
  // Mành: 70 until mid-June, 75 since; today's rate (current_daily_rate) is 80.
  const withMonthRates: LaborMonthlySummaryResponse = {
    rows: [
      {
        year: 2026,
        month: 7,
        total_days: 2,
        total_cost: 150,
        workers: [
          { worker_id: "w1", worker_name: "Mành", days_worked: 2, total_cost: 150, daily_rate: 75, month_start_rate: 75 },
        ],
      },
      {
        year: 2026,
        month: 6,
        total_days: 5,
        total_cost: 360,
        workers: [
          { worker_id: "w1", worker_name: "Mành", days_worked: 5, total_cost: 360, daily_rate: 75, month_start_rate: 70 },
        ],
      },
    ],
  };
  const props = {
    ...baseProps,
    monthlySummary: withMonthRates,
    workers: [makeWorker({ id: "w1", name: "Mành", daily_rate: 70, current_daily_rate: 80 })],
  };

  it("shows each month's own rate, not today's", () => {
    render(<LaborSummary {...props} month="" onSiteToday={0} />);
    expect(screen.getByTestId("worker-subrow-2026-07-w1").textContent).toContain(
      'summaryPerDay:{"rate":"€75.00"}',
    );
    expect(screen.queryByText('summaryPerDay:{"rate":"€80.00"}')).toBeNull();
  });

  it("shows 'A → B' for a month in which the rate changed", () => {
    render(<LaborSummary {...props} month="" onSiteToday={0} />);
    expect(screen.getByTestId("worker-subrow-2026-06-w1").textContent).toContain(
      'summaryPerDay:{"rate":"€70.00 → €75.00"}',
    );
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

describe("LaborSummary — bonus KPI in all-history mode", () => {
  const withBonus: LaborMonthlySummaryResponse = {
    rows: [
      {
        year: 2026,
        month: 10,
        total_days: 1,
        total_cost: 160,
        total_bonus_cost: 60,
        total_banked_hours: 4,
        total_bonus_days: 0.5,
        workers: [{ worker_id: "w1", worker_name: "Mành", days_worked: 1, total_cost: 160 }],
      },
      {
        year: 2025,
        month: 9,
        total_days: 2,
        total_cost: 470,
        total_bonus_cost: 270,
        total_banked_hours: 20,
        total_bonus_days: 2.5,
        workers: [{ worker_id: "w1", worker_name: "Mành", days_worked: 2, total_cost: 470 }],
      },
    ],
  };
  // The last month viewed: must not leak into the all-history KPI.
  const staleMonth: LaborSummaryResponse = {
    rows: [],
    total_days: 0,
    total_cost: 0,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  };

  it("sums the visible months' bonus instead of the single-month summary", () => {
    render(
      <LaborSummary
        {...baseProps}
        monthlySummary={withBonus}
        summary={staleMonth}
        month=""
        onSiteToday={0}
      />,
    );
    const label = screen.getByText("supplement.bonusCost");
    expect(label.parentElement?.textContent).toContain("€330.00");
    expect(screen.getByText('supplement.bonusDaysSubtitle:{"days":"3","count":3}')).toBeInTheDocument();
    expect(
      screen.getByText('supplement.banner:{"banked":24,"bonusDays":"3","count":3,"bonusCost":"€330.00"}'),
    ).toBeInTheDocument();
  });
});
