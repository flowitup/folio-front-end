/**
 * Tests for labor-payments-tab-state — the pure merge/status/default-month
 * helpers backing the Payments tab (kept out of the component for
 * standalone unit testing, mirroring log-day-dialog-state.test.ts).
 */

import { describe, it, expect } from "vitest";
import {
  findMonthBucket,
  mergeWorkerPaymentRows,
  monthToDateRange,
  pickDefaultMonth,
  statusForBalance,
} from "../labor-payments-tab-state";
import type {
  LaborMonthlySummaryResponse,
  LaborPaymentsMonthBucket,
  LaborPaymentsSummaryResponse,
  LaborSummaryResponse,
} from "@/types/labor";

function summaryRow(overrides: Partial<LaborSummaryResponse["rows"][number]> = {}) {
  return {
    worker_id: "w1",
    worker_name: "Jean Dupont",
    days_worked: 10,
    total_cost: 1500,
    banked_hours: 0,
    bonus_full_days: 0,
    bonus_half_days: 0,
    bonus_cost: 0,
    ...overrides,
  };
}

function makeSummary(rows: ReturnType<typeof summaryRow>[]): LaborSummaryResponse {
  return {
    rows,
    total_days: rows.reduce((s, r) => s + r.days_worked, 0),
    total_cost: rows.reduce((s, r) => s + r.total_cost, 0),
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  };
}

function makeBucket(overrides: Partial<LaborPaymentsMonthBucket> = {}): LaborPaymentsMonthBucket {
  return {
    year: 2026,
    month: 7,
    total_paid: 0,
    workers: [],
    unassigned_paid: 0,
    unassigned_count: 0,
    ...overrides,
  };
}

// ── statusForBalance ────────────────────────────────────────────────────────

describe("statusForBalance", () => {
  it("unpaid when paid is 0 and owed > 0", () => {
    expect(statusForBalance(0, 1000)).toBe("unpaid");
  });

  it("partial when 0 < paid < owed", () => {
    expect(statusForBalance(400, 1000)).toBe("partial");
  });

  it("settled when paid equals owed exactly", () => {
    expect(statusForBalance(1000, 1000)).toBe("settled");
  });

  it("settled when the gap is within the 0.01 epsilon", () => {
    expect(statusForBalance(999.995, 1000)).toBe("settled");
  });

  it("partial (not settled) just outside the epsilon", () => {
    expect(statusForBalance(999.98, 1000)).toBe("partial");
  });

  it("overpaid when paid exceeds owed", () => {
    expect(statusForBalance(1200, 1000)).toBe("overpaid");
  });

  it("settled when both owed and paid are 0", () => {
    expect(statusForBalance(0, 0)).toBe("settled");
  });
});

// ── mergeWorkerPaymentRows ───────────────────────────────────────────────────

describe("mergeWorkerPaymentRows", () => {
  it("worker with entries only (no payments this month)", () => {
    const summary = makeSummary([summaryRow({ worker_id: "w1", worker_name: "Jean", total_cost: 1500, days_worked: 10 })]);
    const rows = mergeWorkerPaymentRows(summary, null);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      worker_id: "w1",
      days_worked: 10,
      owed: 1500,
      paid: 0,
      balance: 1500,
      invoice_count: 0,
      status: "unpaid",
    });
  });

  it("worker with payments only (no labor entries this month)", () => {
    const bucket = makeBucket({
      workers: [{ worker_id: "w2", worker_name: "Marc", paid: 500, invoice_count: 1 }],
    });
    const rows = mergeWorkerPaymentRows(null, bucket);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      worker_id: "w2",
      worker_name: "Marc",
      days_worked: 0,
      owed: 0,
      paid: 500,
      balance: -500,
      invoice_count: 1,
      status: "overpaid",
    });
  });

  it("worker with both entries and payments merges into one row", () => {
    const summary = makeSummary([summaryRow({ worker_id: "w1", worker_name: "Jean", total_cost: 1500, days_worked: 10 })]);
    const bucket = makeBucket({
      workers: [{ worker_id: "w1", worker_name: "Jean", paid: 1000, invoice_count: 2 }],
    });
    const rows = mergeWorkerPaymentRows(summary, bucket);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      worker_id: "w1",
      days_worked: 10,
      owed: 1500,
      paid: 1000,
      balance: 500,
      invoice_count: 2,
      status: "partial",
    });
  });

  it("unions distinct workers from both sources and sorts by name", () => {
    const summary = makeSummary([summaryRow({ worker_id: "w1", worker_name: "Zed", total_cost: 100, days_worked: 1 })]);
    const bucket = makeBucket({
      workers: [{ worker_id: "w2", worker_name: "Alice", paid: 200, invoice_count: 1 }],
    });
    const rows = mergeWorkerPaymentRows(summary, bucket);

    expect(rows.map((r) => r.worker_id)).toEqual(["w2", "w1"]);
  });

  it("returns an empty array when both sources are empty/null", () => {
    expect(mergeWorkerPaymentRows(null, null)).toEqual([]);
    expect(mergeWorkerPaymentRows(makeSummary([]), makeBucket({ workers: [] }))).toEqual([]);
  });
});

// ── findMonthBucket ──────────────────────────────────────────────────────────

describe("findMonthBucket", () => {
  const paymentsSummary: LaborPaymentsSummaryResponse = {
    months: [
      makeBucket({ year: 2026, month: 7, total_paid: 900 }),
      makeBucket({ year: 2026, month: 6, total_paid: 400 }),
      makeBucket({ year: null, month: null, total_paid: 50 }),
    ],
  };

  it("finds the bucket matching the given YYYY-MM month", () => {
    expect(findMonthBucket(paymentsSummary, "2026-07")?.total_paid).toBe(900);
    expect(findMonthBucket(paymentsSummary, "2026-06")?.total_paid).toBe(400);
  });

  it("returns null for a month with no bucket", () => {
    expect(findMonthBucket(paymentsSummary, "2026-01")).toBeNull();
  });

  it("returns null for malformed month strings or null summary", () => {
    expect(findMonthBucket(paymentsSummary, "")).toBeNull();
    expect(findMonthBucket(null, "2026-07")).toBeNull();
  });
});

// ── monthToDateRange ─────────────────────────────────────────────────────────

describe("monthToDateRange", () => {
  it("returns the first/last day of the month", () => {
    expect(monthToDateRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthToDateRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" }); // leap year
  });

  it("returns null for malformed input", () => {
    expect(monthToDateRange("not-a-month")).toBeNull();
    expect(monthToDateRange("")).toBeNull();
  });
});

// ── pickDefaultMonth ─────────────────────────────────────────────────────────

describe("pickDefaultMonth", () => {
  const now = new Date(2026, 6, 15); // July 2026 (0-indexed month)

  it("picks the most recent month with entries when payments are empty", () => {
    const monthly: LaborMonthlySummaryResponse = {
      rows: [
        { year: 2026, month: 5, total_days: 1, total_cost: 1, workers: [] },
        { year: 2026, month: 3, total_days: 1, total_cost: 1, workers: [] },
      ],
    };
    expect(pickDefaultMonth(monthly, null, now)).toBe("2026-05");
  });

  it("picks the most recent month with payments when entries are empty", () => {
    const paymentsSummary: LaborPaymentsSummaryResponse = {
      months: [makeBucket({ year: 2026, month: 4 }), makeBucket({ year: 2025, month: 12 })],
    };
    expect(pickDefaultMonth(null, paymentsSummary, now)).toBe("2026-04");
  });

  it("picks the later of the two most-recent months across both sources", () => {
    const monthly: LaborMonthlySummaryResponse = {
      rows: [{ year: 2026, month: 2, total_days: 1, total_cost: 1, workers: [] }],
    };
    const paymentsSummary: LaborPaymentsSummaryResponse = {
      months: [makeBucket({ year: 2026, month: 6 })],
    };
    expect(pickDefaultMonth(monthly, paymentsSummary, now)).toBe("2026-06");
  });

  it("ignores the null year/month 'no service_month' bucket", () => {
    const paymentsSummary: LaborPaymentsSummaryResponse = {
      months: [makeBucket({ year: null, month: null })],
    };
    expect(pickDefaultMonth(null, paymentsSummary, now)).toBe("2026-07"); // falls back to `now`
  });

  it("falls back to the current month when both sources are empty", () => {
    expect(pickDefaultMonth(null, null, now)).toBe("2026-07");
    expect(pickDefaultMonth({ rows: [] }, { months: [] }, now)).toBe("2026-07");
  });
});
