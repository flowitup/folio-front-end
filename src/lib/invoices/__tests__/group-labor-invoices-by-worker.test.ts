/**
 * Tests for the pure grouping helpers behind the Expenses page's
 * worker-grouped labor display: worker bucketing (linked / unassigned /
 * mixed), alphabetical sort with Unassigned last, per-worker totals/count,
 * last-payment resolution, and service_month history ordering.
 */

import { describe, it, expect } from "vitest";
import {
  groupLaborInvoicesByWorker,
  groupInvoicesByServiceMonth,
} from "../group-labor-invoices-by-worker";
import type { Invoice } from "@/types/invoice";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "FR-2026-0001",
    type: "labor",
    issue_date: "2026-06-01",
    recipient_name: "Worker",
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

describe("groupLaborInvoicesByWorker — bucketing", () => {
  it("groups invoices linked to the same worker_id into one bucket", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w1", recipient_name: "Alice", total_amount: 100 }),
      makeInvoice({ id: "i2", worker_id: "w1", recipient_name: "Alice", total_amount: 200 }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups).toHaveLength(1);
    expect(groups[0].workerId).toBe("w1");
    expect(groups[0].invoiceCount).toBe(2);
    expect(groups[0].totalPaid).toBe(300);
  });

  it("puts all worker_id-null invoices into a single Unassigned bucket, never grouped by recipient_name", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: null, recipient_name: "Bob" }),
      makeInvoice({ id: "i2", worker_id: null, recipient_name: "Carol" }),
      makeInvoice({ id: "i3", worker_id: undefined, recipient_name: "Bob" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups).toHaveLength(1);
    expect(groups[0].workerId).toBeNull();
    expect(groups[0].invoiceCount).toBe(3);
    expect(groups[0].displayName).toBeNull();
  });

  it("splits a mixed list into per-worker buckets plus one Unassigned bucket", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w1", recipient_name: "Alice" }),
      makeInvoice({ id: "i2", worker_id: "w2", recipient_name: "Bruno" }),
      makeInvoice({ id: "i3", worker_id: null, recipient_name: "Unlinked Co" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups.map((g) => g.workerId)).toEqual(["w1", "w2", null]);
  });
});

describe("groupLaborInvoicesByWorker — sort order", () => {
  it("sorts worker groups alphabetically by display name", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-z", recipient_name: "Zoe" }),
      makeInvoice({ id: "i2", worker_id: "w-a", recipient_name: "Alice" }),
      makeInvoice({ id: "i3", worker_id: "w-m", recipient_name: "Marco" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups.map((g) => g.displayName)).toEqual(["Alice", "Marco", "Zoe"]);
  });

  it("always sorts the Unassigned group last, regardless of alphabetical order", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: null, recipient_name: "AAA — would sort first" }),
      makeInvoice({ id: "i2", worker_id: "w1", recipient_name: "Zoe" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups.map((g) => g.workerId)).toEqual(["w1", null]);
  });
});

describe("groupLaborInvoicesByWorker — display name and last payment", () => {
  it("uses the most-recently-issued invoice's recipient_name snapshot as display name", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w1", recipient_name: "Old Name", issue_date: "2026-01-01" }),
      makeInvoice({ id: "i2", worker_id: "w1", recipient_name: "New Name", issue_date: "2026-06-01" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups[0].displayName).toBe("New Name");
  });

  it("last payment prefers the max service_month over issue_date", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w1", service_month: "2026-03-01", issue_date: "2026-06-01" }),
      makeInvoice({ id: "i2", worker_id: "w1", service_month: "2026-05-01", issue_date: "2026-01-01" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups[0].lastPaymentValue).toBe("2026-05-01");
  });

  it("falls back to the latest issue_date when no invoice in the group has a service_month", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w1", service_month: null, issue_date: "2026-02-15" }),
      makeInvoice({ id: "i2", worker_id: "w1", service_month: null, issue_date: "2026-07-01" }),
    ];
    const groups = groupLaborInvoicesByWorker(invoices);
    expect(groups[0].lastPaymentValue).toBe("2026-07-01");
  });
});

describe("groupInvoicesByServiceMonth — month history ordering", () => {
  it("groups by YYYY-MM and orders most-recent month first", () => {
    const invoices = [
      makeInvoice({ id: "i1", service_month: "2026-03-01" }),
      makeInvoice({ id: "i2", service_month: "2026-06-01" }),
      makeInvoice({ id: "i3", service_month: "2026-01-01" }),
    ];
    const groups = groupInvoicesByServiceMonth(invoices);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-06", "2026-03", "2026-01"]);
  });

  it("puts the no-month bucket (service_month null) last, even after older months", () => {
    const invoices = [
      makeInvoice({ id: "i1", service_month: null }),
      makeInvoice({ id: "i2", service_month: "2026-01-01" }),
    ];
    const groups = groupInvoicesByServiceMonth(invoices);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-01", null]);
  });

  it("keeps multiple invoices for the same month in one bucket", () => {
    const invoices = [
      makeInvoice({ id: "i1", service_month: "2026-04-01" }),
      makeInvoice({ id: "i2", service_month: "2026-04-01" }),
    ];
    const groups = groupInvoicesByServiceMonth(invoices);
    expect(groups).toHaveLength(1);
    expect(groups[0].invoices).toHaveLength(2);
  });
});
