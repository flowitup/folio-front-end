/**
 * InvoiceDetailContent action bar at phone width: the bar sits inside
 * overflow-hidden wrappers, so it must wrap rather than overflow, or Edit and
 * Delete are clipped and unreachable on a 375px screen.
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
}));

vi.mock("@/components/invoices/invoice-attachments", () => ({
  InvoiceAttachments: () => <div data-testid="invoice-attachments" />,
}));


vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Stub PaymentMethodSelect: exposes a button that fires onChange("pm-new")
// on click, plus the current value/disabled state as data attributes so
// tests can assert without exercising the real popover/combobox internals.
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: ({
    value,
    onChange,
    disabled,
  }: {
    value: string | null;
    onChange: (id: string | null) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid="payment-method-select"
      data-value={value ?? ""}
      data-disabled={disabled ?? false}
      disabled={disabled}
      onClick={() => onChange("pm-new")}
    >
      change
    </button>
  ),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────



// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-ms-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Bank",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 5000,
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

function renderDetail(overrides: {
  invoice?: Partial<Invoice>;
  canManage?: boolean;
  companyId?: string | null;
  onUpdated?: (updated: Invoice) => void;
} = {}) {
  const onUpdated = overrides.onUpdated ?? vi.fn();
  render(
    <InvoiceDetailContent
      invoice={makeInvoice(overrides.invoice)}
      canManage={overrides.canManage ?? true}
      companyId={"companyId" in overrides ? overrides.companyId : "co-1"}
      onUpdated={onUpdated}
      onDeleted={vi.fn()}
      printUrl="/en/projects/proj-1/invoices/inv-rf-1/print"
    />,
  );
  return { onUpdated };
}

beforeEach(() => vi.clearAllMocks());


describe("InvoiceDetailContent — action bar on a phone", () => {
  it("lets the header and the action group wrap so no action is clipped off-screen", () => {
    renderDetail();
    const actions = screen.getByTestId("invoice-detail-actions");
    expect(actions.className).toContain("flex-wrap");
    expect(actions.parentElement?.className).toContain("flex-wrap");
    expect(screen.getByText("INV-2026-0001").className).toContain("whitespace-nowrap");
  });

  it("keeps print, edit and delete reachable by name", () => {
    renderDetail({ invoice: { paid_by_company: true } });
    expect(screen.getByRole("button", { name: "invoices.printPdf" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /invoices\.edit/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "invoices.delete" })).toBeTruthy();
  });
});
