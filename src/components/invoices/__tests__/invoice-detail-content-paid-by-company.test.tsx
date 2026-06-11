/**
 * Tests for InvoiceDetailContent — transfer action gating when paid_by_company.
 *
 * Covers:
 * - Transfer action hidden when paid_by_company=true (M&S, null status, canManage)
 * - Transfer action shown when paid_by_company=false (M&S, null status, canManage)
 * - Transfer action shown when paid_by_company absent (M&S, null status, canManage)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDetailContent } from "../invoice-detail-content";
import type { Invoice } from "@/types/invoice";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string) =>
      namespace ? `${namespace}.${key}` : key,
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

vi.mock("@/components/invoices/invoice-form", () => ({
  InvoiceForm: () => <div data-testid="invoice-form" />,
}));

vi.mock("@/components/invoices/invoice-attachments", () => ({
  InvoiceAttachments: () => <div data-testid="invoice-attachments" />,
}));

vi.mock("@/lib/api/tags-client", () => ({
  fetchTagsClient: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/invoice-api", () => ({
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-dc-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Paint", quantity: 1, unit_price: 100, total: 100 }],
    total_amount: 100,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    ...overrides,
  };
}

function renderDetail(invoice: Invoice, canManage = true) {
  return render(
    <InvoiceDetailContent
      invoice={invoice}
      canManage={canManage}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      printUrl="/en/projects/proj-1/invoices/inv-dc-1/print"
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

describe("InvoiceDetailContent — transfer action visibility with paid_by_company", () => {
  it("hides transfer action when paid_by_company=true", () => {
    renderDetail(
      makeInvoice({ type: "materials_services", refundable_status: null, paid_by_company: true }),
    );
    expect(
      screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).toBeNull();
  });

  it("shows transfer action when paid_by_company=false", () => {
    renderDetail(
      makeInvoice({ type: "materials_services", refundable_status: null, paid_by_company: false }),
    );
    expect(
      screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).not.toBeNull();
  });

  it("shows transfer action when paid_by_company is absent", () => {
    renderDetail(makeInvoice({ type: "materials_services", refundable_status: null }));
    expect(
      screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).not.toBeNull();
  });

  it("hides transfer action for non-M&S even when paid_by_company=false", () => {
    renderDetail(
      makeInvoice({ type: "labor", refundable_status: null, paid_by_company: false }),
    );
    expect(
      screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).toBeNull();
  });

  it("hides transfer action when canManage=false even if paid_by_company=false", () => {
    renderDetail(
      makeInvoice({ type: "materials_services", refundable_status: null, paid_by_company: false }),
      false,
    );
    expect(
      screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).toBeNull();
  });
});
