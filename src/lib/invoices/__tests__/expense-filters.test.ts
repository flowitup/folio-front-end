/**
 * Tests for the Expense page client-side filter helpers.
 *
 * Covers:
 * - matchesQuery: case-insensitive match over recipient, invoice number,
 *   item descriptions, notes; empty query matches everything
 * - inMonthRange: inclusive "YYYY-MM" bounds, unbounded when a side is empty
 * - chipCounts: per-type + "all" totals
 */

import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import { matchesQuery, inMonthRange, chipCounts } from "../expense-filters";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-15",
    recipient_name: "Acme Supplies",
    recipient_address: null,
    notes: null,
    items: [{ description: "Cement bags", quantity: 10, unit_price: 12, total: 120 }],
    total_amount: 120,
    created_by: "user-1",
    created_at: "2026-06-15T00:00:00Z",
    updated_at: "2026-06-15T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches everything on an empty query", () => {
    expect(matchesQuery(makeInvoice(), "")).toBe(true);
    expect(matchesQuery(makeInvoice(), "   ")).toBe(true);
  });

  it("matches recipient_name case-insensitively", () => {
    expect(matchesQuery(makeInvoice({ recipient_name: "Acme Supplies" }), "acme")).toBe(true);
    expect(matchesQuery(makeInvoice({ recipient_name: "Acme Supplies" }), "ACME")).toBe(true);
  });

  it("matches invoice_number", () => {
    expect(matchesQuery(makeInvoice({ invoice_number: "INV-2026-0042" }), "0042")).toBe(true);
  });

  it("matches an item description", () => {
    const inv = makeInvoice({
      items: [{ description: "Steel beams", quantity: 2, unit_price: 500, total: 1000 }],
    });
    expect(matchesQuery(inv, "steel")).toBe(true);
  });

  it("matches notes", () => {
    expect(matchesQuery(makeInvoice({ notes: "Urgent delivery" }), "urgent")).toBe(true);
  });

  it("returns false when notes is null and query is not found elsewhere", () => {
    expect(matchesQuery(makeInvoice({ notes: null }), "nonexistent")).toBe(false);
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(makeInvoice(), "nonexistent-term")).toBe(false);
  });
});

describe("inMonthRange", () => {
  it("matches everything when both bounds are empty", () => {
    expect(inMonthRange(makeInvoice({ issue_date: "2026-06-15" }), "", "")).toBe(true);
  });

  it("respects the lower bound", () => {
    expect(inMonthRange(makeInvoice({ issue_date: "2026-06-15" }), "2026-06", "")).toBe(true);
    expect(inMonthRange(makeInvoice({ issue_date: "2026-05-15" }), "2026-06", "")).toBe(false);
  });

  it("respects the upper bound", () => {
    expect(inMonthRange(makeInvoice({ issue_date: "2026-06-15" }), "", "2026-06")).toBe(true);
    expect(inMonthRange(makeInvoice({ issue_date: "2026-07-15" }), "", "2026-06")).toBe(false);
  });

  it("is inclusive on both bounds", () => {
    const inv = makeInvoice({ issue_date: "2026-06-01" });
    expect(inMonthRange(inv, "2026-06", "2026-06")).toBe(true);
  });

  it("excludes months outside a [from, to] range", () => {
    expect(inMonthRange(makeInvoice({ issue_date: "2026-04-01" }), "2026-05", "2026-07")).toBe(false);
    expect(inMonthRange(makeInvoice({ issue_date: "2026-08-01" }), "2026-05", "2026-07")).toBe(false);
    expect(inMonthRange(makeInvoice({ issue_date: "2026-06-01" }), "2026-05", "2026-07")).toBe(true);
  });
});

describe("chipCounts", () => {
  it("counts zero for an empty list", () => {
    expect(chipCounts([])).toEqual({
      all: 0,
      released_funds: 0,
      labor: 0,
      materials_services: 0,
      others: 0,
      return: 0,
    });
  });

  it("counts per type plus the all total", () => {
    const invoices = [
      makeInvoice({ id: "a", type: "released_funds" }),
      makeInvoice({ id: "b", type: "labor" }),
      makeInvoice({ id: "c", type: "labor" }),
      makeInvoice({ id: "d", type: "materials_services" }),
      makeInvoice({ id: "e", type: "others" }),
      makeInvoice({ id: "f", type: "return" }),
    ];
    expect(chipCounts(invoices)).toEqual({
      all: 6,
      released_funds: 1,
      labor: 2,
      materials_services: 1,
      others: 1,
      return: 1,
    });
  });
});
