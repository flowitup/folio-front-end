import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import {
  computeBankReleaseMetrics,
  buildReleaseSeries,
} from "@/lib/dashboard/bank-release-metrics";

let seq = 0;
function mkInvoice(
  partial: Partial<Invoice> & Pick<Invoice, "type" | "issue_date" | "total_amount">
): Invoice {
  seq += 1;
  return {
    id: `inv-${seq}`,
    project_id: "p-1",
    invoice_number: `INV-${seq}`,
    recipient_name: "Bank",
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

describe("computeBankReleaseMetrics", () => {
  it("subtracts released funds from the credit", () => {
    const m = computeBankReleaseMetrics(200_000, 75_000);
    expect(m.hasCredit).toBe(true);
    expect(m.credit).toBe(200_000);
    expect(m.released).toBe(75_000);
    expect(m.remaining).toBe(125_000);
    expect(m.pct).toBe(38);
    expect(m.pctClamped).toBe(38);
  });

  it("reports no credit when the budget is null, zero or negative", () => {
    for (const credit of [null, undefined, 0, -5]) {
      const m = computeBankReleaseMetrics(credit, 1_000);
      expect(m.hasCredit).toBe(false);
      expect(m.credit).toBe(0);
      expect(m.pct).toBe(0);
      expect(m.remaining).toBe(-1_000);
    }
  });

  it("goes negative and clamps the bar when more was drawn than granted", () => {
    const m = computeBankReleaseMetrics(100_000, 130_000);
    expect(m.remaining).toBe(-30_000);
    expect(m.pct).toBe(130);
    expect(m.pctClamped).toBe(100);
  });

  it("keeps the full credit remaining when nothing has been released", () => {
    const m = computeBankReleaseMetrics(50_000, 0);
    expect(m.remaining).toBe(50_000);
    expect(m.pct).toBe(0);
  });
});

describe("buildReleaseSeries", () => {
  it("returns an empty series when there are no releases", () => {
    expect(
      buildReleaseSeries([
        mkInvoice({ type: "materials_services", issue_date: "2026-03-04", total_amount: 900 }),
      ])
    ).toEqual([]);
  });

  it("groups released_funds rows by issue month and accumulates", () => {
    const series = buildReleaseSeries([
      mkInvoice({ type: "released_funds", issue_date: "2026-01-10", total_amount: 20_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-01-28", total_amount: 5_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-03-02", total_amount: 10_000 }),
      mkInvoice({ type: "labor", issue_date: "2026-02-02", total_amount: 4_000 }),
    ]);
    expect(series.map((p) => p.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series.map((p) => p.amount)).toEqual([25_000, 0, 10_000]);
    expect(series.map((p) => p.count)).toEqual([2, 0, 1]);
    expect(series.map((p) => p.cumulative)).toEqual([25_000, 25_000, 35_000]);
  });

  it("fills the gap across a year boundary", () => {
    const series = buildReleaseSeries([
      mkInvoice({ type: "released_funds", issue_date: "2025-11-01", total_amount: 1_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-02-01", total_amount: 2_000 }),
    ]);
    expect(series.map((p) => p.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(series[series.length - 1].cumulative).toBe(3_000);
  });

  it("uses issue_date, not service_month, for a release", () => {
    const series = buildReleaseSeries([
      mkInvoice({
        type: "released_funds",
        issue_date: "2026-05-06",
        service_month: "2026-01",
        total_amount: 7_000,
      }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe("2026-05");
  });
});
