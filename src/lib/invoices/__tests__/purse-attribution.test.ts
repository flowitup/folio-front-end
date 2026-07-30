/**
 * Tests for purse-attribution — shared `isPersonalExpense`/`purseLabelKey`
 * used by ExpensePursesSummary (dataviz) and the drawer/split detail
 * surfaces (phase 03).
 */

import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import { isPersonalExpense, purseLabelKey } from "../purse-attribution";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1000,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

describe("isPersonalExpense", () => {
  it("is false when paid_by_personal is absent/false", () => {
    expect(isPersonalExpense(makeInvoice())).toBe(false);
    expect(isPersonalExpense(makeInvoice({ paid_by_personal: false }))).toBe(false);
  });

  it("is true for a personally-paid expense with no refund status", () => {
    expect(isPersonalExpense(makeInvoice({ paid_by_personal: true }))).toBe(true);
  });

  it("stays personal while refund is only pending/refundable, not yet refunded", () => {
    expect(
      isPersonalExpense(
        makeInvoice({ paid_by_personal: true, refundable_status: "refundable" })
      )
    ).toBe(true);
    expect(
      isPersonalExpense(
        makeInvoice({ paid_by_personal: true, refundable_status: "refund_pending" })
      )
    ).toBe(true);
  });

  it("flips to company money once refunded by the company (not by bank)", () => {
    expect(
      isPersonalExpense(
        makeInvoice({
          paid_by_personal: true,
          refundable_status: "refunded",
          refunded_by: "company",
        })
      )
    ).toBe(false);
    // Legacy rows with refunded_by=null are treated as company-refunded.
    expect(
      isPersonalExpense(
        makeInvoice({ paid_by_personal: true, refundable_status: "refunded", refunded_by: null })
      )
    ).toBe(false);
  });

  it("stays personal when refunded by bank instead of the company", () => {
    expect(
      isPersonalExpense(
        makeInvoice({
          paid_by_personal: true,
          refundable_status: "refunded",
          refunded_by: "bank",
        })
      )
    ).toBe(true);
  });
});

describe("purseLabelKey", () => {
  it("is null for released_funds regardless of payment attribution", () => {
    expect(purseLabelKey(makeInvoice({ type: "released_funds", paid_by_personal: true }))).toBeNull();
    expect(purseLabelKey(makeInvoice({ type: "released_funds" }))).toBeNull();
  });

  it("is 'personal' for a personally-paid, non-released expense", () => {
    expect(purseLabelKey(makeInvoice({ type: "labor", paid_by_personal: true }))).toBe("personal");
  });

  it("is 'company' for a non-personal expense", () => {
    expect(purseLabelKey(makeInvoice({ type: "materials_services" }))).toBe("company");
  });
});
