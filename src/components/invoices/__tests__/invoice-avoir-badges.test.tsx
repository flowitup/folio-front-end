/**
 * invoice-avoir-badges.test.tsx
 *
 * Real-component tests for the avoir-return display additions:
 * - InvoiceMobileCard: AVOIR badge, "Applied to {number}" sub-label,
 *   "outstanding" stamp (avoir with no applied_to_invoice_id)
 * - InvoiceDetailContent: "Paid with avoir {number} (amount)" line(s) from
 *   paid_with_returns, rendered near the payment method row
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceMobileCard } from "../invoice-mobile-card";
import { InvoiceDetailContent } from "../invoice-detail-content";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      "settledVia.avoirBadge": "Avoir",
      "settledVia.outstanding": "Outstanding avoir",
      "appliedTo": values ? `Applied to ${values.number}` : "Applied to {number}",
      "refundOf": values ? `Return of ${values.number}` : "Return of {number}",
      "paidWithAvoir": values
        ? `Paid with avoir ${values.number} (${values.amount})`
        : "Paid with avoir {number} ({amount})",
    };
    const full = namespace ? `${namespace}.${key}` : key;
    return translations[key] ?? translations[full] ?? full;
  },
  useLocale: () => "en",
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
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "ARC-2026-0001",
    type: "return",
    issue_date: "2026-05-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Credit", quantity: 1, unit_price: -100, total: -100 }],
    total_amount: -100,
    created_by: "user-1",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

// ── InvoiceMobileCard ─────────────────────────────────────────────────────────

describe("InvoiceMobileCard — avoir badges", () => {
  const formatAmount = (n: number) => `${n} €`;

  it("shows the AVOIR badge when settled_via='avoir'", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ settled_via: "avoir" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.getByTestId("avoir-badge").textContent).toBe("Avoir");
  });

  it("does NOT show the AVOIR badge for a cash-settled return", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ settled_via: "cash" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.queryByTestId("avoir-badge")).toBeNull();
  });

  it("does NOT show the AVOIR badge when settled_via is null (untouched/legacy)", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ settled_via: null })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.queryByTestId("avoir-badge")).toBeNull();
  });

  it("shows 'Applied to {number}' when applied_to_invoice_number is present", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          settled_via: "avoir",
          applied_to_invoice_id: "target-1",
          applied_to_invoice_number: "FR-2026-0042",
        })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.getByTestId("applied-to-label").textContent).toBe("Applied to FR-2026-0042");
  });

  it("shows the outstanding-avoir stamp when settled_via='avoir' has no applied link", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ settled_via: "avoir", applied_to_invoice_id: null })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.getByTestId("outstanding-avoir-stamp").textContent).toBe("Outstanding avoir");
    expect(screen.queryByTestId("applied-to-label")).toBeNull();
  });

  it("does NOT show the outstanding-avoir stamp once applied to an invoice", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          settled_via: "avoir",
          applied_to_invoice_id: "target-1",
          applied_to_invoice_number: "FR-2026-0042",
        })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.queryByTestId("outstanding-avoir-stamp")).toBeNull();
  });

  it("does NOT show any avoir markers for a materials_services invoice", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          type: "materials_services",
          settled_via: "avoir",
          applied_to_invoice_id: null,
        } as Partial<Invoice>)}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );
    expect(screen.queryByTestId("avoir-badge")).toBeNull();
    expect(screen.queryByTestId("outstanding-avoir-stamp")).toBeNull();
    expect(screen.queryByTestId("applied-to-label")).toBeNull();
  });
});

// ── InvoiceDetailContent — "Paid with avoir" ──────────────────────────────────

describe("InvoiceDetailContent — paid_with_returns", () => {
  it("renders a 'Paid with avoir' line per entry when paid_with_returns is non-empty", () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({
          id: "target-1",
          type: "materials_services",
          total_amount: 500,
          items: [{ description: "Paint", quantity: 1, unit_price: 500, total: 500 }],
          paid_with_returns: [
            { invoice_number: "ARC-2026-0001", total_amount: -141.6 },
            { invoice_number: "ARC-2026-0002", total_amount: -50 },
          ],
        })}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );

    const block = screen.getByTestId("paid-with-avoir");
    expect(block.textContent).toContain("Paid with avoir ARC-2026-0001");
    expect(block.textContent).toContain("Paid with avoir ARC-2026-0002");
  });

  it("does NOT render the paid-with-avoir block when paid_with_returns is empty", () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({
          id: "target-1",
          type: "materials_services",
          total_amount: 500,
          paid_with_returns: [],
        })}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );
    expect(screen.queryByTestId("paid-with-avoir")).toBeNull();
  });

  it("does NOT render the paid-with-avoir block when paid_with_returns is absent", () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ id: "target-1", type: "materials_services", total_amount: 500 })}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );
    expect(screen.queryByTestId("paid-with-avoir")).toBeNull();
  });
});
