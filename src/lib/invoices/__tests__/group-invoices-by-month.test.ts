/**
 * Tests for the pure grouping helper behind the Expenses page's
 * month-grouped "All" tab: month-key resolution (labor service_month vs
 * issue_date), month ordering, per-month category order with empty skips,
 * net subtotals, and row ordering inside a category.
 */

import { describe, it, expect } from "vitest";
import {
  monthKeyForInvoice,
  groupInvoicesByMonth,
  GROUP_ORDER,
} from "../group-invoices-by-month";
import type { Invoice } from "@/types/invoice";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "ARC-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 100,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    worker_id: null,
    ...overrides,
  };
}

describe("monthKeyForInvoice", () => {
  it("buckets a labor invoice under its service_month, not its issue month", () => {
    const inv = makeInvoice({ type: "labor", issue_date: "2026-07-18", service_month: "2026-06-01" });
    expect(monthKeyForInvoice(inv)).toBe("2026-06");
  });

  it("falls back to issue_date for labor without a service_month", () => {
    const inv = makeInvoice({ type: "labor", issue_date: "2026-07-18", service_month: null });
    expect(monthKeyForInvoice(inv)).toBe("2026-07");
  });

  it("uses issue_date for non-labor types even when service_month is set", () => {
    const inv = makeInvoice({ type: "materials_services", issue_date: "2026-07-18", service_month: "2026-06-01" });
    expect(monthKeyForInvoice(inv)).toBe("2026-07");
  });
});

describe("groupInvoicesByMonth", () => {
  it("sorts month sections most-recent-first", () => {
    const groups = groupInvoicesByMonth([
      makeInvoice({ id: "i1", issue_date: "2026-05-10" }),
      makeInvoice({ id: "i2", issue_date: "2026-08-02" }),
      makeInvoice({ id: "i3", issue_date: "2026-06-20" }),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-08", "2026-06", "2026-05"]);
  });

  it("keeps categories in canonical order and skips empty ones", () => {
    const groups = groupInvoicesByMonth([
      makeInvoice({ id: "i1", type: "others", issue_date: "2026-06-05" }),
      makeInvoice({ id: "i2", type: "labor", issue_date: "2026-06-10", service_month: "2026-06-01" }),
      makeInvoice({ id: "i3", type: "released_funds", issue_date: "2026-06-01" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].categories.map((c) => c.type)).toEqual([
      "released_funds",
      "labor",
      "others",
    ]);
    // Canonical order is the module's exported constant — guard against drift.
    expect(GROUP_ORDER).toEqual(["released_funds", "labor", "materials_services", "others", "return"]);
  });

  it("computes a net subtotal per month, negative returns included", () => {
    const groups = groupInvoicesByMonth([
      makeInvoice({ id: "i1", type: "materials_services", issue_date: "2026-06-05", total_amount: 500 }),
      makeInvoice({ id: "i2", type: "return", issue_date: "2026-06-14", total_amount: -209.16 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].subtotal).toBeCloseTo(290.84, 5);
  });

  it("places a July-issued June-service labor invoice in the June section alongside June expenses", () => {
    const groups = groupInvoicesByMonth([
      makeInvoice({ id: "june-mat", type: "materials_services", issue_date: "2026-06-20", total_amount: 50 }),
      makeInvoice({
        id: "june-pay",
        type: "labor",
        issue_date: "2026-07-18",
        service_month: "2026-06-01",
        total_amount: 25,
      }),
      makeInvoice({ id: "july-mat", type: "materials_services", issue_date: "2026-07-03", total_amount: 10 }),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-07", "2026-06"]);
    const june = groups[1];
    expect(june.subtotal).toBe(75);
    expect(june.categories.map((c) => c.type)).toEqual(["labor", "materials_services"]);
    expect(june.categories[0].items.map((i) => i.id)).toEqual(["june-pay"]);
  });

  it("sorts rows in a category by issue_date desc with invoice_number desc tiebreak", () => {
    const groups = groupInvoicesByMonth([
      makeInvoice({ id: "a", issue_date: "2026-06-05", invoice_number: "ARC-2026-0010" }),
      makeInvoice({ id: "b", issue_date: "2026-06-20", invoice_number: "ARC-2026-0011" }),
      makeInvoice({ id: "c", issue_date: "2026-06-05", invoice_number: "ARC-2026-0012" }),
    ]);
    expect(groups[0].categories[0].items.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("returns an empty list for no invoices", () => {
    expect(groupInvoicesByMonth([])).toEqual([]);
  });
});
