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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("LaborSummary — past-month unpaid warning (all-history mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const monthly: LaborMonthlySummaryResponse = {
    rows: [
      { year: 2026, month: 8, total_days: 4, total_cost: 400, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 4, total_cost: 400 }] },
      { year: 2026, month: 7, total_days: 10, total_cost: 1000, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 10, total_cost: 1000 }] },
      { year: 2026, month: 6, total_days: 5, total_cost: 500, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500 }] },
    ],
  };
  const payments: LaborPaymentsSummaryResponse = {
    months: [
      { year: 2026, month: 8, total_paid: 0, workers: [], unassigned_paid: 0, unassigned_count: 0 },
      { year: 2026, month: 7, total_paid: 700, workers: [{ worker_id: "w1", worker_name: "Alice", paid: 700, invoice_count: 1 }], unassigned_paid: 0, unassigned_count: 0 },
      { year: 2026, month: 6, total_paid: 500, workers: [{ worker_id: "w1", worker_name: "Alice", paid: 500, invoice_count: 1 }], unassigned_paid: 0, unassigned_count: 0 },
    ],
  };

  it("warns on past months with a shortfall, never on the current month or settled months", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthly}
        month=""
        paymentsSummary={payments}
      />,
    );

    // July: past, 1000 owed vs 700 paid -> warn with the 300 shortfall.
    const warn = screen.getByTestId("month-unpaid-warning-2026-07");
    expect(warn.textContent).toContain("300");
    // August: current month, unpaid -> deliberately NOT flagged.
    expect(screen.queryByTestId("month-unpaid-warning-2026-08")).toBeNull();
    // June: fully settled -> no warning.
    expect(screen.queryByTestId("month-unpaid-warning-2026-06")).toBeNull();
  });
});

describe("LaborSummary — overpaid warning (all-history mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const monthly: LaborMonthlySummaryResponse = {
    rows: [
      { year: 2026, month: 8, total_days: 4, total_cost: 400, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 4, total_cost: 400 }] },
      { year: 2026, month: 7, total_days: 10, total_cost: 1000, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 10, total_cost: 1000 }] },
      { year: 2026, month: 6, total_days: 5, total_cost: 500, workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500 }] },
    ],
  };
  const payments: LaborPaymentsSummaryResponse = {
    months: [
      // August (current month): 400 owed vs 650 paid -> overpaid by 250.
      { year: 2026, month: 8, total_paid: 650, workers: [{ worker_id: "w1", worker_name: "Alice", paid: 650, invoice_count: 1 }], unassigned_paid: 0, unassigned_count: 0 },
      // July: 1000 owed vs 1400 paid -> overpaid by 400.
      { year: 2026, month: 7, total_paid: 1400, workers: [{ worker_id: "w1", worker_name: "Alice", paid: 1400, invoice_count: 2 }], unassigned_paid: 0, unassigned_count: 0 },
      // June: exactly settled -> no badge of either kind.
      { year: 2026, month: 6, total_paid: 500, workers: [{ worker_id: "w1", worker_name: "Alice", paid: 500, invoice_count: 1 }], unassigned_paid: 0, unassigned_count: 0 },
    ],
  };

  it("warns on any month paid over its labor charge — current month included", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthly}
        month=""
        paymentsSummary={payments}
      />,
    );

    // July: past month overpaid -> badge with the 400 excess.
    const july = screen.getByTestId("month-overpaid-warning-2026-07");
    expect(july.textContent).toContain("400");
    // August: overpaying is anomalous even mid-month -> badge with the 250 excess.
    const august = screen.getByTestId("month-overpaid-warning-2026-08");
    expect(august.textContent).toContain("250");
    // June: exactly settled -> neither badge.
    expect(screen.queryByTestId("month-overpaid-warning-2026-06")).toBeNull();
    expect(screen.queryByTestId("month-unpaid-warning-2026-06")).toBeNull();
  });

  it("never shows unpaid and overpaid badges on the same month", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthly}
        month=""
        paymentsSummary={payments}
      />,
    );
    for (const ym of ["2026-06", "2026-07", "2026-08"]) {
      const both =
        screen.queryByTestId(`month-unpaid-warning-${ym}`) != null &&
        screen.queryByTestId(`month-overpaid-warning-${ym}`) != null;
      expect(both).toBe(false);
    }
  });
});

describe("LaborSummary — overpaid balance tint (single-month mode)", () => {
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
        total_paid: 1100,
        workers: [
          // Alice: 500 owed vs 800 paid -> balance -300, flagged overpaid.
          { worker_id: "w1", worker_name: "Alice", paid: 800, invoice_count: 2 },
          // Bob: 500 owed vs 300 paid -> balance 200, not flagged.
          { worker_id: "w2", worker_name: "Bob", paid: 300, invoice_count: 1 },
        ],
        unassigned_paid: 0,
        unassigned_count: 0,
      },
    ],
  };

  it("flags a worker whose Paid exceeds their Total for the month", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    const flagged = screen.getByTestId("worker-overpaid-w1");
    expect(flagged.textContent).toContain("-300");
    expect(screen.queryByTestId("worker-overpaid-w2")).toBeNull();
  });

  it("flags the footer Balance when the month as a whole is overpaid", () => {
    render(
      <LaborSummary
        {...baseProps}
        summary={summary}
        monthlySummary={null}
        month="2026-06"
        paymentsSummary={paymentsSummary}
      />,
    );
    // Footer: 1000 owed vs 1100 paid -> balance -100 -> flagged.
    expect(screen.getByTestId("footer-overpaid")).toBeInTheDocument();
  });
});

describe("LaborSummary — company/personal paid split caption (all-history mode)", () => {
  const monthlySummary: LaborMonthlySummaryResponse = {
    rows: [
      {
        year: 2026,
        month: 7,
        total_days: 10,
        total_cost: 1000,
        workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 10, total_cost: 1000 }],
      },
      {
        year: 2026,
        month: 6,
        total_days: 5,
        total_cost: 500,
        workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500 }],
      },
      {
        year: 2026,
        month: 5,
        total_days: 2,
        total_cost: 200,
        workers: [{ worker_id: "w1", worker_name: "Alice", days_worked: 2, total_cost: 200 }],
      },
    ],
  };

  // July: both halves; June: personal only; May: no split (e.g. unflagged
  // methods) — caption absent even though the month has paid amounts.
  const paymentsSummary: LaborPaymentsSummaryResponse = {
    months: [
      {
        year: 2026,
        month: 7,
        total_paid: 700,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 700, invoice_count: 2 }],
        unassigned_paid: 0,
        unassigned_count: 0,
        company_paid: 550,
        personal_paid: 150,
      },
      {
        year: 2026,
        month: 6,
        total_paid: 400,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 400, invoice_count: 1 }],
        unassigned_paid: 0,
        unassigned_count: 0,
        company_paid: 0,
        personal_paid: 400,
      },
      {
        year: 2026,
        month: 5,
        total_paid: 200,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 200, invoice_count: 1 }],
        unassigned_paid: 0,
        unassigned_count: 0,
        company_paid: 0,
        personal_paid: 0,
      },
    ],
  };

  function renderAllHistory() {
    return render(
      <LaborSummary
        {...baseProps}
        summary={null}
        monthlySummary={monthlySummary}
        month=""
        paymentsSummary={paymentsSummary}
      />,
    );
  }

  it("month row shows both halves joined with a separator", () => {
    renderAllHistory();
    const caption = screen.getByTestId("month-paid-split-2026-07");
    expect(caption.textContent).toContain('payments.companyShare:{"amount":"€550.00"}');
    expect(caption.textContent).toContain('payments.personalShare:{"amount":"€150.00"}');
    expect(caption.textContent).toContain(" · ");
  });

  it("renders only the non-zero half", () => {
    renderAllHistory();
    const caption = screen.getByTestId("month-paid-split-2026-06");
    expect(caption.textContent).toContain('payments.personalShare:{"amount":"€400.00"}');
    expect(caption.textContent).not.toContain("companyShare");
    expect(caption.textContent).not.toContain(" · ");
  });

  it("renders no caption when the month's split is all-zero (unflagged/no-method payments)", () => {
    renderAllHistory();
    expect(screen.queryByTestId("month-paid-split-2026-05")).toBeNull();
  });

  it("footer aggregates the split across visible months", () => {
    renderAllHistory();
    const caption = screen.getByTestId("all-history-paid-split");
    expect(caption.textContent).toContain('payments.companyShare:{"amount":"€550.00"}');
    expect(caption.textContent).toContain('payments.personalShare:{"amount":"€550.00"}');
  });

  it("renders no captions at all when paymentsSummary is absent", () => {
    render(
      <LaborSummary {...baseProps} summary={null} monthlySummary={monthlySummary} month="" paymentsSummary={null} />,
    );
    expect(screen.queryByTestId("month-paid-split-2026-07")).toBeNull();
    expect(screen.queryByTestId("all-history-paid-split")).toBeNull();
  });
});
