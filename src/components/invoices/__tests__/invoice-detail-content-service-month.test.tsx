/**
 * Tests for InvoiceDetailContent — labor "payment for month" (service_month) row
 *
 * Covers:
 * - Month detail row renders for labor invoices with service_month set
 * - Month detail row is absent when service_month is null
 * - Month detail row is absent for non-labor invoices even if service_month is set
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
  useLocale: () => "en",
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

vi.mock("@/components/invoices/invoice-form", () => ({
  InvoiceForm: () => <div data-testid="invoice-form" />,
  classifySubmitError: (err: unknown) => (err instanceof Error ? err.message : "error"),
}));

vi.mock("@/components/invoices/invoice-attachments", () => ({
  InvoiceAttachments: () => <div data-testid="invoice-attachments" />,
}));


vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-sm-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "labor",
    issue_date: "2026-06-01",
    recipient_name: "Worker Co",
    recipient_address: null,
    notes: null,
    items: [{ description: "June labor", quantity: 1, unit_price: 1000, total: 1000 }],
    total_amount: 1000,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...overrides,
  };
}

function renderDetail(invoice: Invoice) {
  return render(
    <InvoiceDetailContent
      invoice={invoice}
      canManage={true}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      printUrl="/en/projects/proj-1/invoices/inv-sm-1/print"
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe("InvoiceDetailContent — service_month row", () => {
  it("shows the month row with localized value when service_month is set", () => {
    renderDetail(makeInvoice({ type: "labor", service_month: "2026-06-01" }));
    expect(screen.getByText("invoices.serviceMonth")).toBeDefined();
    expect(screen.getByText("June 2026")).toBeDefined();
  });

  it("hides the month row when service_month is null", () => {
    renderDetail(makeInvoice({ type: "labor", service_month: null }));
    expect(screen.queryByText("invoices.serviceMonth")).toBeNull();
  });

  it("hides the month row for non-labor invoices even if service_month is set", () => {
    renderDetail(
      makeInvoice({ type: "materials_services", service_month: "2026-06-01" })
    );
    expect(screen.queryByText("invoices.serviceMonth")).toBeNull();
  });
});
