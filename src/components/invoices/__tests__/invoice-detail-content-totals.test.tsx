/**
 * HT / VAT split of an expense: exact half-up cents, rows that add up, and
 * quantities and rates in the app language.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDetailContent } from "../invoice-detail-content";
import type { Invoice } from "@/types/invoice";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string) =>
      namespace ? `${namespace}.${key}` : key,
  useLocale: () => "fr",
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


vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("@/lib/api/projects", () => ({
  fetchProjectById: vi.fn().mockResolvedValue({ company_id: "co-1" }),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────


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
    service_month: null,
    ...overrides,
  };
}



describe("InvoiceDetailContent — HT / VAT totals", () => {
  it("shows the HT subtotal rounded half-up (50,30 €, not 50,29 €) and French quantities and rates", () => {
    const invoice = makeInvoice({
      items: [{ description: "Tile", quantity: 1.5, unit_price: 33.53, vat_rate: 20, total: 60.354 }],
      total_amount: 60.35,
    });
    render(
      <InvoiceDetailContent
        invoice={invoice}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/fr/projects/proj-1/invoices/inv-dc-1/print"
      />,
    );

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/50,30\s€/);
    expect(text).not.toMatch(/50,29\s€/);
    expect(text).toMatch(/10,05\s€/);
    expect(screen.getAllByText("1,5").length).toBeGreaterThan(0);
    expect(text).toMatch(/20\s%/);
  });
});

describe("InvoiceDetailContent — how an avoir was settled", () => {
  function renderReturn(overrides: Partial<Invoice>) {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "return", total_amount: -43.1, ...overrides })}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/fr/projects/proj-1/invoices/inv-dc-1/print"
      />,
    );
    return screen.getByTestId("invoice-settlement");
  }

  it("shows the invoice an applied avoir paid for", () => {
    const block = renderReturn({
      settled_via: "avoir",
      applied_to_invoice_id: "inv-9",
      applied_to_invoice_number: "INV-2026-0009",
    });
    expect(block).toHaveTextContent("invoices.settledVia.avoir");
    expect(block).toHaveTextContent("INV-2026-0009");
    expect(block).not.toHaveTextContent("invoices.settledVia.outstanding");
  });

  it("flags an avoir not applied yet", () => {
    const block = renderReturn({ settled_via: "avoir", applied_to_invoice_id: null });
    expect(block).toHaveTextContent("invoices.settledVia.outstanding");
  });

  it("shows a cash refund", () => {
    expect(renderReturn({ settled_via: "cash" })).toHaveTextContent("invoices.settledVia.cash");
  });
});
