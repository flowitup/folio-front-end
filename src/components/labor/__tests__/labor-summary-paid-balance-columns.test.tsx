/**
 * Tests for LaborSummary's Paid/Balance columns — the labor-payments-summary
 * data merged into both table modes.
 *
 * Single-month mode: Paid matched per worker for the viewed month; Balance =
 * this row's already-rendered Total minus Paid; footer sums both.
 *
 * All-history mode: month header Paid = the bucket's total (assigned +
 * unassigned) with a "+ n unassigned" hint; per-worker sub-rows get Paid
 * only, matched strictly by (worker_id, month) so a worker's payment in one
 * month never leaks into another month's row; no Balance column at all.
 *
 * Zero-paid renders as "—" everywhere, per the locked design decision.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaborSummary } from "../labor-summary";
import type {
  LaborSummaryResponse,
  LaborMonthlySummaryResponse,
  LaborPaymentsSummaryResponse,
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

function summaryRow(overrides: Partial<LaborSummaryResponse["rows"][number]> = {}) {
  return {
    worker_id: "w1",
    worker_name: "Alice",
    days_worked: 5,
    total_cost: 500,
    banked_hours: 0,
    bonus_full_days: 0,
    bonus_half_days: 0,
    bonus_cost: 0,
    ...overrides,
  };
}

const baseProps = {
  projectId: "proj-1",
  workers: [],
  isLoading: false,
  onMonthChange: () => {},
};

describe("LaborSummary — Paid/Balance columns (single-month mode)", () => {
  const summary: LaborSummaryResponse = {
    rows: [
      summaryRow({ worker_id: "w1", worker_name: "Alice", total_cost: 500 }),
      summaryRow({ worker_id: "w2", worker_name: "Bob", total_cost: 500 }),
    ],
    total_days: 10,
    total_cost: 1000,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  };

  const paymentsSummary: LaborPaymentsSummaryResponse = {
    months: [
      {
        year: 2026,
        month: 6,
        total_paid: 500,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 300, invoice_count: 1 }],
        unassigned_paid: 200,
        unassigned_count: 1,
      },
    ],
  };

  it("shows Paid matched by worker_id for the viewed month", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    const aliceRow = screen.getByText("Alice").closest("tr")!;
    expect(aliceRow.textContent).toContain("€300.00");
  });

  it("renders '—' (not €0.00) for a worker with no payments this month", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    const bobRow = screen.getByText("Bob").closest("tr")!;
    expect(bobRow.textContent).not.toContain("€0.00");
    expect(bobRow.textContent).toContain("—");
  });

  it("computes Balance as this row's already-rendered Total minus Paid", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    // Alice: Total 500, Paid 300 → Balance 200.
    const aliceRow = screen.getByText("Alice").closest("tr")!;
    expect(aliceRow.textContent).toContain("€200.00");
    // Bob: Total 500, Paid 0 → Balance 500 (full amount still owed).
    const bobRow = screen.getByText("Bob").closest("tr")!;
    expect(bobRow.textContent).toContain("€500.00");
  });

  it("renders the Paid and Balance column headers", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    expect(screen.getByText("payments.paid")).toBeInTheDocument();
    expect(screen.getByText("payments.balance")).toBeInTheDocument();
  });

  it("footer sums Paid/Balance from the same per-worker matches as the rows (excludes unassigned)", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    // Footer Paid = 300 (Alice) + 0 (Bob) = 300 — NOT the bucket's total_paid
    // (500), which also folds in the 200 of unassigned payments.
    const footerRow = screen.getByText("grandTotal").closest("tr")!;
    expect(footerRow.textContent).toContain("€300.00");
    // Footer Balance = summary.total_cost (1000) - footerPaid (300) = 700.
    expect(footerRow.textContent).toContain("€700.00");
  });

  it("falls back to '—' Paid and Balance === Total when paymentsSummary is absent", () => {
    render(
      <LaborSummary {...baseProps} summary={summary} monthlySummary={null} month="2026-06" />,
    );
    const aliceRow = screen.getByText("Alice").closest("tr")!;
    expect(aliceRow.textContent).toContain("—");
    expect(aliceRow.textContent).toContain("€500.00");
  });
});

describe("LaborSummary — Paid column (all-history mode)", () => {
  const monthlySummary: LaborMonthlySummaryResponse = {
    rows: [
      {
        year: 2026,
        month: 7,
        total_days: 10,
        total_cost: 1000,
        workers: [
          { worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500 },
          { worker_id: "w2", worker_name: "Bob", days_worked: 5, total_cost: 500 },
        ],
      },
      {
        year: 2026,
        month: 6,
        total_days: 5,
        total_cost: 500,
        workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500 }],
      },
    ],
  };

  const paymentsSummary: LaborPaymentsSummaryResponse = {
    months: [
      {
        year: 2026,
        month: 7,
        total_paid: 700,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 500, invoice_count: 1 }],
        unassigned_paid: 200,
        unassigned_count: 2,
      },
      {
        year: 2026,
        month: 6,
        total_paid: 0,
        workers: [],
        unassigned_paid: 0,
        unassigned_count: 0,
      },
    ],
  };

  it("month header Paid = bucket.total_paid (assigned + unassigned)", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    const julyRow = screen.getByTestId("month-row-2026-07");
    expect(julyRow.textContent).toContain("€700.00");
  });

  it("shows a '+ n unassigned' hint only when the month has unassigned payments", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    const julyRow = screen.getByTestId("month-row-2026-07");
    expect(julyRow.textContent).toContain('summaryUnassignedHint:{"n":2}');

    const juneRow = screen.getByTestId("month-row-2026-06");
    expect(juneRow.textContent).not.toContain("summaryUnassignedHint");
  });

  it("month header Paid renders '—' when the month has no payments at all", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    const juneRow = screen.getByTestId("month-row-2026-06");
    expect(juneRow.textContent).toContain("—");
    expect(juneRow.textContent).not.toContain("€0.00");
  });

  it("per-worker sub-row Paid is matched strictly by (worker_id, month) — no cross-month leakage", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    // Alice was paid 500 in July...
    const aliceJuly = screen.getByTestId("worker-subrow-2026-07-w1");
    expect(aliceJuly.textContent).toContain("€500.00");
    // ...but nothing in June, even though she has entries that month too.
    const aliceJune = screen.getByTestId("worker-subrow-2026-06-w1");
    expect(aliceJune.textContent).toContain("—");
    expect(aliceJune.textContent).not.toContain("€0.00");
    // Bob has no payments recorded in July at all.
    const bobJuly = screen.getByTestId("worker-subrow-2026-07-w2");
    expect(bobJuly.textContent).toContain("—");
  });

  it("has no Balance column anywhere in the all-history table", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    expect(screen.queryByText("payments.balance")).toBeNull();
  });

  it("footer Paid sums total_paid across all visible months", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
    // 700 (July) + 0 (June) = 700.
    const footerRow = screen.getByText("grandTotal").closest("tr")!;
    expect(footerRow.textContent).toContain("€700.00");
  });
});
