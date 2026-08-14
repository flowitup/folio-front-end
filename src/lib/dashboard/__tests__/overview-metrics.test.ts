import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import {
  isPersonalExpense,
  computeSpentTotal,
  buildMonthlySpendSeries,
  computeMonthDelta,
  computeBudgetMetrics,
  computePendingRefunds,
  computeBankOutstanding,
  buildPurseViews,
  buildTypeMonthlyBuckets,
  sharedMonthlyMax,
} from "@/lib/dashboard/overview-metrics";

let seq = 0;
function mkInvoice(partial: Partial<Invoice> & Pick<Invoice, "type" | "issue_date" | "total_amount">): Invoice {
  seq += 1;
  return {
    id: `inv-${seq}`,
    project_id: "p-1",
    invoice_number: `INV-${seq}`,
    recipient_name: "Vendor",
    recipient_address: null,
    notes: null,
    items: [],
    created_by: "u-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...partial,
  };
}

describe("isPersonalExpense", () => {
  it("true for a personally-paid, not-yet-refunded expense", () => {
    expect(
      isPersonalExpense(mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 10, paid_by_personal: true }))
    ).toBe(true);
  });

  it("false for company-paid expenses", () => {
    expect(
      isPersonalExpense(mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 10, paid_by_personal: false }))
    ).toBe(false);
  });

  it("false once refunded by the company (money already returned)", () => {
    expect(
      isPersonalExpense(
        mkInvoice({
          type: "materials_services",
          issue_date: "2026-06-01",
          total_amount: 10,
          paid_by_personal: true,
          refundable_status: "refunded",
          refunded_by: "company",
        })
      )
    ).toBe(false);
  });

  it("stays personal when refunded by bank (a linked return invoice, not company cash)", () => {
    expect(
      isPersonalExpense(
        mkInvoice({
          type: "materials_services",
          issue_date: "2026-06-01",
          total_amount: 10,
          paid_by_personal: true,
          refundable_status: "refunded",
          refunded_by: "bank",
        })
      )
    ).toBe(true);
  });
});

describe("computeSpentTotal", () => {
  it("sums spend types and excludes released_funds and return", () => {
    const invoices = [
      mkInvoice({ type: "labor", issue_date: "2026-06-01", total_amount: 100 }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 50 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-06-01", total_amount: 500 }),
      mkInvoice({ type: "return", issue_date: "2026-06-01", total_amount: 20 }),
    ];
    expect(computeSpentTotal(invoices)).toBe(150);
  });
});

describe("buildMonthlySpendSeries", () => {
  it("gap-fills months with no spend and keeps the requested length", () => {
    const invoices = [
      mkInvoice({ type: "labor", issue_date: "2026-04-15", total_amount: 100 }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-02", total_amount: 40 }),
    ];
    const series = buildMonthlySpendSeries(invoices, 3, new Date(2026, 5, 20)); // Apr, May, Jun
    expect(series.map((p) => p.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(series[0]).toMatchObject({ total: 100, count: 1 });
    expect(series[1]).toMatchObject({ total: 0, count: 0 });
    expect(series[2]).toMatchObject({ total: 40, count: 1 });
  });

  it("attributes labor to service_month, others to issue_date", () => {
    const invoices = [
      mkInvoice({ type: "labor", issue_date: "2026-06-05", service_month: "2026-05-01", total_amount: 300 }),
    ];
    const series = buildMonthlySpendSeries(invoices, 2, new Date(2026, 5, 1)); // May, Jun
    expect(series[0]).toMatchObject({ key: "2026-05", total: 300 });
    expect(series[1]).toMatchObject({ key: "2026-06", total: 0 });
  });

  it("excludes released_funds and return rows", () => {
    const invoices = [
      mkInvoice({ type: "released_funds", issue_date: "2026-06-01", total_amount: 1000 }),
      mkInvoice({ type: "return", issue_date: "2026-06-01", total_amount: 30 }),
    ];
    const series = buildMonthlySpendSeries(invoices, 1, new Date(2026, 5, 1));
    expect(series[0].total).toBe(0);
  });
});

describe("computeMonthDelta", () => {
  it("computes a rounded percent change vs the previous point", () => {
    const series = [
      { key: "2026-05", total: 100, count: 1 },
      { key: "2026-06", total: 92, count: 1 },
    ];
    expect(computeMonthDelta(series).deltaPct).toBe(-8);
  });

  it("is null when the previous month had zero spend (avoids ÷0)", () => {
    const series = [
      { key: "2026-05", total: 0, count: 0 },
      { key: "2026-06", total: 92, count: 1 },
    ];
    expect(computeMonthDelta(series).deltaPct).toBeNull();
  });

  it("is null with a single point (no previous month)", () => {
    const series = [{ key: "2026-06", total: 92, count: 1 }];
    const delta = computeMonthDelta(series);
    expect(delta.deltaPct).toBeNull();
    expect(delta.previous).toBeNull();
  });
});

describe("computeBudgetMetrics", () => {
  it("uses the project credit total as denominator when set", () => {
    const m = computeBudgetMetrics(1000, 400, 900);
    expect(m).toMatchObject({ denominator: 1000, usesBudget: true, left: 600, pct: 40, pctClamped: 40 });
  });

  it("falls back to funds released when no credit total is set", () => {
    const m = computeBudgetMetrics(null, 400, 900);
    expect(m).toMatchObject({ denominator: 900, usesBudget: false });
  });

  it("falls back to funds released when the credit total is 0", () => {
    const m = computeBudgetMetrics(0, 400, 900);
    expect(m.usesBudget).toBe(false);
    expect(m.denominator).toBe(900);
  });

  it("goes negative and clamps the bar width when over budget", () => {
    const m = computeBudgetMetrics(1000, 1250, 900);
    expect(m.left).toBe(-250);
    expect(m.pct).toBe(125);
    expect(m.pctClamped).toBe(100);
  });

  it("denominator 0 yields pct 0 (no NaN)", () => {
    const m = computeBudgetMetrics(null, 0, 0);
    expect(m.pct).toBe(0);
    expect(m.pctClamped).toBe(0);
  });
});

describe("computePendingRefunds", () => {
  it("sums only personal expenses awaiting reimbursement", () => {
    const invoices = [
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 100, paid_by_personal: true, refundable_status: "refundable" }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 50, paid_by_personal: true, refundable_status: "refund_pending" }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 40, paid_by_personal: true, refundable_status: "refunded", refunded_by: "company" }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 30, paid_by_personal: false, refundable_status: "refundable" }),
    ];
    expect(computePendingRefunds(invoices)).toEqual({ count: 2, total: 150 });
  });

  it("excludes released_funds/return rows even if flagged personal+refundable (BE-unreachable edge, FE shouldn't rely on the guard)", () => {
    const invoices = [
      mkInvoice({ type: "released_funds", issue_date: "2026-06-01", total_amount: 900, paid_by_personal: true, refundable_status: "refundable" }),
      mkInvoice({ type: "return", issue_date: "2026-06-01", total_amount: 60, paid_by_personal: true, refundable_status: "refund_pending" }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 100, paid_by_personal: true, refundable_status: "refundable" }),
    ];
    expect(computePendingRefunds(invoices)).toEqual({ count: 1, total: 100 });
  });
});

describe("computeBankOutstanding", () => {
  it("tracks the bank channel independently of refundable_status", () => {
    const invoices = [
      // Neither side settled — counts in BOTH balances.
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 100, paid_by_personal: true, refundable_status: "refundable" }),
      // Company reimbursed, bank has not — bank still owes it. This is the row
      // computePendingRefunds drops and the old single figure lost entirely.
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 40, paid_by_personal: true, refundable_status: "refunded", refunded_by: "company" }),
      // Both settled — in neither balance.
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 25, paid_by_personal: true, refundable_status: "refunded", refunded_by: "both" }),
      // Bank settled only — out of the bank balance.
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 70, paid_by_personal: true, refundable_status: "refunded", refunded_by: "bank" }),
      // Not refund-tracked at all.
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 30, paid_by_personal: false }),
    ];
    // 100 + 40 — deliberately overlapping computePendingRefunds (which sees only
    // the 100), and larger than it, so the two must never be summed.
    expect(computeBankOutstanding(invoices)).toEqual({ count: 2, total: 140 });
    expect(computePendingRefunds(invoices)).toEqual({ count: 1, total: 100 });
  });

  it("counts a company-reimbursed expense even though it left the personal purse", () => {
    const invoices = [
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 640, paid_by_personal: true, refundable_status: "refunded", refunded_by: "company" }),
    ];
    expect(computeBankOutstanding(invoices)).toEqual({ count: 1, total: 640 });
  });

  it("excludes released_funds/return rows", () => {
    const invoices = [
      mkInvoice({ type: "released_funds", issue_date: "2026-06-01", total_amount: 900, refundable_status: "refundable" }),
      mkInvoice({ type: "return", issue_date: "2026-06-01", total_amount: -60, refundable_status: "refundable" }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 100, paid_by_personal: true, refundable_status: "refundable" }),
    ];
    expect(computeBankOutstanding(invoices)).toEqual({ count: 1, total: 100 });
  });
});

describe("buildPurseViews", () => {
  it("splits counts client-side and falls back the company release when unset", () => {
    const invoices = [
      mkInvoice({ type: "labor", issue_date: "2026-06-01", total_amount: 10, paid_by_personal: false }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 20, paid_by_personal: true }),
      mkInvoice({ type: "released_funds", issue_date: "2026-06-01", total_amount: 1000 }),
    ];
    const purses = buildPurseViews(invoices, {
      fundsReleasedTotal: 1000,
      fundsReleasedPersonalTotal: 300,
      companySpentTotal: 10,
      personalSpentTotal: 20,
    });
    expect(purses).toEqual([
      { key: "company", released: 700, spent: 10, count: 1 },
      { key: "personal", released: 300, spent: 20, count: 1 },
    ]);
  });

  it("uses the explicit company release split when the backend provides it", () => {
    const purses = buildPurseViews([], {
      fundsReleasedTotal: 1000,
      fundsReleasedCompanyTotal: 750,
      fundsReleasedPersonalTotal: 250,
      companySpentTotal: 0,
      personalSpentTotal: 0,
    });
    expect(purses[0].released).toBe(750);
    expect(purses[1].released).toBe(250);
  });
});

describe("buildTypeMonthlyBuckets / sharedMonthlyMax", () => {
  it("buckets per type over the window and computes a shared max across all types", () => {
    const invoices = [
      mkInvoice({ type: "labor", issue_date: "2026-06-01", total_amount: 500 }),
      mkInvoice({ type: "materials_services", issue_date: "2026-06-01", total_amount: 120 }),
      mkInvoice({ type: "others", issue_date: "2026-05-01", total_amount: 40 }),
    ];
    const buckets = buildTypeMonthlyBuckets(invoices, 2, new Date(2026, 5, 15)); // May, Jun
    const labor = buckets.find((b) => b.type === "labor")!;
    const materials = buckets.find((b) => b.type === "materials_services")!;
    const others = buckets.find((b) => b.type === "others")!;

    expect(labor.total).toBe(500);
    expect(labor.count).toBe(1);
    expect(materials.total).toBe(120);
    expect(others.monthly.map((p) => p.total)).toEqual([40, 0]);

    // Shared max is the single largest month across ALL types (labor's 500).
    expect(sharedMonthlyMax(buckets)).toBe(500);
  });

  it("sharedMonthlyMax floors at 1 with no spend anywhere (avoids ÷0 bar heights)", () => {
    const buckets = buildTypeMonthlyBuckets([], 3, new Date(2026, 5, 1));
    expect(sharedMonthlyMax(buckets)).toBe(1);
  });
});
