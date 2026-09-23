/**
 * Tests for InvoiceDetailContent — a company cash advance (a released_funds row
 * flagged is_cash_advance) is headed as "Others" with the cash-advance badge,
 * matching the ledger and the export; a plain release keeps its own type.
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
    id: "inv-rf-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "released_funds",
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
    source_billing_document_id: "doc-1",
    is_auto_generated: true,
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

// ── Visibility ────────────────────────────────────────────────────────────────

describe("InvoiceDetailContent — cash advance header", () => {
  beforeEach(() => vi.clearAllMocks());

  it("heads a cash advance as Others with the cash-advance badge", () => {
    renderDetail({ invoice: { is_cash_advance: true, is_auto_generated: false } });
    expect(screen.getByText("invoices.types.others")).toBeTruthy();
    expect(screen.queryByText("invoices.types.released_funds")).toBeNull();
    expect(screen.getByTestId("cash-advance-badge-detail").textContent).toBe(
      "invoices.cashAdvance.badge"
    );
  });

  it("keeps a plain release headed as Released Funds, without the badge", () => {
    renderDetail({ invoice: { is_auto_generated: false } });
    expect(screen.getByText("invoices.types.released_funds")).toBeTruthy();
    expect(screen.queryByTestId("cash-advance-badge-detail")).toBeNull();
  });
});
