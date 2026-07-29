/**
 * invoice-mobile-card-refund-type.test.tsx
 *
 * Tests for refund-type styling in InvoiceMobileCard:
 * - Negative total_amount renders with text-destructive class
 * - type=refund shows "Return of {number}" when refunds_invoice_number present
 * - type=refund without refunds_invoice_number shows no "Return of" text
 * - Positive amount has no destructive class
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceMobileCard } from "../invoice-mobile-card";
import type { Invoice } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    if (key === "refundOf" && values) return `Return of ${values.number}`;
    return namespace ? `${namespace}.${key}` : key;
  },
  useLocale: () => "en",
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-05-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Item", quantity: 1, unit_price: 100, total: 100 }],
    total_amount: 100,
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoiceMobileCard — refund type display", () => {
  const formatAmount = (n: number) => `${n.toFixed(2)} €`;

  it("renders negative total_amount with text-destructive class", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ type: "return", total_amount: -200 })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    // The formatted amount element should carry the destructive class
    const amountEl = screen.getByText("-200.00 €");
    expect(amountEl.className).toContain("text-destructive");
  });

  it("renders positive total_amount without text-destructive class", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ total_amount: 300 })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    const amountEl = screen.getByText("300.00 €");
    expect(amountEl.className).not.toContain("text-destructive");
  });

  it("shows 'Return of {number}' when type=refund and refunds_invoice_number present", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          type: "return",
          total_amount: -170,
          refunds_invoice_number: "INV-001",
        })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    expect(screen.getByText("Return of INV-001")).toBeDefined();
  });

  it("does NOT show 'Return of' when refunds_invoice_number is absent", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ type: "return", total_amount: -170 })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    expect(screen.queryByText(/Return of/)).toBeNull();
  });

  it("does NOT show 'Return of' for non-refund type even with refunds_invoice_number", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          type: "materials_services",
          // TypeScript allows this field on Invoice
          refunds_invoice_number: "INV-001",
        } as Partial<Invoice>)}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    expect(screen.queryByText(/Return of/)).toBeNull();
  });

  it("refund type shows 'stamp warning' class via TYPE_STAMP_CLASS", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ type: "return", total_amount: -100 })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
      />,
    );

    // The type stamp renders via t(`types.return`) which in mock returns "invoices.types.return"
    const typeStamp = screen.getByText("invoices.types.return");
    expect(typeStamp.className).toContain("stamp");
    expect(typeStamp.className).toContain("warning");
  });
});
