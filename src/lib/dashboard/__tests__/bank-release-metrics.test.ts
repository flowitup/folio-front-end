import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import {
  computeBankReleaseMetrics,
  buildDrawSeries,
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

describe("buildDrawSeries", () => {
  it("returns an empty series when there are no releases", () => {
    const series = buildDrawSeries([
      mkInvoice({ type: "materials_services", issue_date: "2026-03-04", total_amount: 900 }),
    ]);
    expect(series.draws).toEqual([]);
    expect(series.months).toEqual([]);
    expect(series.totalDrawn).toBe(0);
    expect(series.largest).toBeNull();
    expect(series.last).toBeNull();
  });

  it("lists released_funds draws oldest first and ignores other types", () => {
    const series = buildDrawSeries([
      mkInvoice({ type: "released_funds", issue_date: "2026-03-02", total_amount: 10_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-01-10", total_amount: 20_000 }),
      mkInvoice({ type: "labor", issue_date: "2026-02-02", total_amount: 4_000 }),
    ]);
    expect(series.draws.map((d) => d.date)).toEqual(["2026-01-10", "2026-03-02"]);
    expect(series.draws.map((d) => d.amount)).toEqual([20_000, 10_000]);
    expect(series.totalDrawn).toBe(30_000);
  });

  it("buckets draws by issue month, filling gaps across a year boundary", () => {
    const series = buildDrawSeries([
      mkInvoice({ type: "released_funds", issue_date: "2025-11-01", total_amount: 1_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2025-11-20", total_amount: 500 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-02-01", total_amount: 2_000 }),
    ]);
    expect(series.months.map((p) => p.key)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(series.months.map((p) => p.amount)).toEqual([1_500, 0, 0, 2_000]);
    expect(series.months.map((p) => p.count)).toEqual([2, 0, 0, 1]);
  });

  it("identifies the largest and the last draw", () => {
    const series = buildDrawSeries([
      mkInvoice({ type: "released_funds", issue_date: "2026-01-10", total_amount: 40_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-03-02", total_amount: 40_000 }),
      mkInvoice({ type: "released_funds", issue_date: "2026-08-12", total_amount: 12_000 }),
    ]);
    // Earliest wins an amount tie.
    expect(series.largest?.date).toBe("2026-01-10");
    expect(series.last?.date).toBe("2026-08-12");
    expect(series.last?.amount).toBe(12_000);
  });

  it("terminates with no month buckets on a malformed issue_date", () => {
    // A non-"YYYY-MM…" date parses to NaN; without the integer guard the
    // month walk never terminates and freezes the tab.
    const series = buildDrawSeries([
      mkInvoice({ type: "released_funds", issue_date: "not-a-date", total_amount: 5_000 }),
    ]);
    expect(series.months).toEqual([]);
    expect(series.draws).toHaveLength(1);
    expect(series.totalDrawn).toBe(5_000);
  });

  it("uses issue_date, not service_month, for a draw", () => {
    const series = buildDrawSeries([
      mkInvoice({
        type: "released_funds",
        issue_date: "2026-05-06",
        service_month: "2026-01",
        total_amount: 7_000,
      }),
    ]);
    expect(series.months).toHaveLength(1);
    expect(series.months[0].key).toBe("2026-05");
  });
});
