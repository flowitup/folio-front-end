/**
 * InvoiceDetailContent on a refunded expense: the API refuses every edit and
 * delete until the refund status is cleared (only the cosmetic highlight is
 * allowed), so Edit/Delete give way to a translated note. A refused delete
 * shows its reason in the UI language, never the API's English text.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceDetailContent } from "../invoice-detail-content";
import type { Invoice } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => (namespace ? `${namespace}.${key}` : key),
  useLocale: () => "fr",
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

// Real error helpers, stub form.
vi.mock("@/components/invoices/invoice-form", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/invoices/invoice-form")>()),
  InvoiceForm: () => <div data-testid="invoice-form" />,
}));

vi.mock("@/components/invoices/invoice-attachments", () => ({
  InvoiceAttachments: () => null,
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { deleteInvoice } from "@/lib/api/invoice-api";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0002",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 200,
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

function renderDetail(invoice: Partial<Invoice>) {
  render(
    <InvoiceDetailContent
      invoice={makeInvoice(invoice)}
      canManage
      companyId="co-1"
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      printUrl="/fr/projects/proj-1/invoices/inv-1/print"
    />
  );
}

describe("InvoiceDetailContent — refunded lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers the highlight but neither Edit nor Delete on a refunded expense, and says why", () => {
    renderDetail({ refundable_status: "refunded" });

    expect(screen.getByLabelText("invoices.highlight.label")).toBeDefined();
    expect(screen.queryByText("invoices.edit")).toBeNull();
    expect(screen.queryByLabelText("invoices.delete")).toBeNull();
    expect(screen.getByTestId("invoice-refunded-locked").textContent).toBe("invoices.errorRefundedLocked");
  });

  it("keeps Edit and Delete while the refund is only pending", () => {
    renderDetail({ refundable_status: "refund_pending" });

    expect(screen.getByText("invoices.edit")).toBeDefined();
    expect(screen.getByLabelText("invoices.delete")).toBeDefined();
    expect(screen.queryByTestId("invoice-refunded-locked")).toBeNull();
  });

  it("shows a refused delete's reason translated, and a translated fallback otherwise", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteInvoice).mockRejectedValueOnce({
      status: 400,
      data: { error: "ValidationError", message: "Unlink or delete this invoice's returns first" },
    });
    renderDetail({});

    fireEvent.click(screen.getByLabelText("invoices.delete"));
    expect(await screen.findByText("invoices.errorUnlinkReturnsFirst")).toBeDefined();

    vi.mocked(deleteInvoice).mockRejectedValueOnce(new Error("Failed to delete invoice"));
    fireEvent.click(screen.getByLabelText("invoices.delete"));
    expect(await screen.findByText("invoices.deleteInvoiceFailed")).toBeDefined();
    expect(screen.queryByText("Failed to delete invoice")).toBeNull();
  });
});
