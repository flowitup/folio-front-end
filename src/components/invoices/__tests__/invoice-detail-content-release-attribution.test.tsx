/**
 * Tests for InvoiceDetailContent — auto-release attribution control.
 *
 * Covers:
 * - Control renders only when canManage && is_auto_generated && type === "released_funds" && companyId
 * - Hidden when any of those conditions is not met
 * - onChange sends a single-field PATCH (payment_method_id only) via updateInvoice
 * - Success path: onUpdated called with the response, success toast shown
 * - Failure path: error toast shown, onUpdated not called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/api/tags-client", () => ({
  fetchTagsClient: vi.fn().mockResolvedValue([]),
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

import { updateInvoice as mockUpdateInvoiceFn } from "@/lib/api/invoice-api";
import { toast } from "sonner";

const mockUpdateInvoice = vi.mocked(mockUpdateInvoiceFn);
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

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

describe("InvoiceDetailContent — release attribution control visibility", () => {
  it("renders when canManage, is_auto_generated, type=released_funds and companyId are all present", () => {
    renderDetail();
    expect(screen.queryByTestId("payment-method-select")).not.toBeNull();
  });

  it("hidden when canManage=false", () => {
    renderDetail({ canManage: false });
    expect(screen.queryByTestId("payment-method-select")).toBeNull();
  });

  it("hidden when invoice is not auto-generated", () => {
    renderDetail({ invoice: { is_auto_generated: false } });
    expect(screen.queryByTestId("payment-method-select")).toBeNull();
  });

  it("hidden when invoice type is not released_funds", () => {
    renderDetail({ invoice: { type: "materials_services" } });
    expect(screen.queryByTestId("payment-method-select")).toBeNull();
  });

  it("hidden when companyId is null", () => {
    renderDetail({ companyId: null });
    expect(screen.queryByTestId("payment-method-select")).toBeNull();
  });
});

// ── Update behaviour ─────────────────────────────────────────────────────────

describe("InvoiceDetailContent — release attribution update", () => {
  it("sends a single-field PATCH (payment_method_id only) and shows success toast", async () => {
    const updated = makeInvoice({ payment_method_id: "pm-new" });
    mockUpdateInvoice.mockResolvedValueOnce(updated);
    const { onUpdated } = renderDetail();

    fireEvent.click(screen.getByTestId("payment-method-select"));

    await waitFor(() => {
      expect(mockUpdateInvoice).toHaveBeenCalledWith("proj-1", "inv-rf-1", {
        payment_method_id: "pm-new",
      });
    });
    // Exactly one field in the payload — backend rejects any other field.
    expect(Object.keys(mockUpdateInvoice.mock.calls[0][2])).toEqual(["payment_method_id"]);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
      expect(mockToastSuccess).toHaveBeenCalledWith("invoices.releaseAttribution.success");
    });
  });

  it("shows error toast and does not call onUpdated on failure", async () => {
    mockUpdateInvoice.mockRejectedValueOnce(new Error("network down"));
    const { onUpdated } = renderDetail();

    fireEvent.click(screen.getByTestId("payment-method-select"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("network down");
    });
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("falls back to the translated generic error when the thrown error has no message", async () => {
    mockUpdateInvoice.mockRejectedValueOnce({});
    renderDetail();

    fireEvent.click(screen.getByTestId("payment-method-select"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("invoices.releaseAttribution.error");
    });
  });
});
