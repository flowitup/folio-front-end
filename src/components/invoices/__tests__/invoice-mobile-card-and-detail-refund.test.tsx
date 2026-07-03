/**
 * Real component tests for refund-tracking behaviour in InvoiceMobileCard
 * and InvoiceDetailContent.
 *
 * Covers:
 * - InvoiceMobileCard: arrow text for each refundable_status when companyName present
 * - InvoiceMobileCard: stamp CSS class and label per status
 * - InvoiceMobileCard: no arrow/stamp when refundable_status is null
 * - InvoiceDetailContent: transfer action visible for M&S + null status + canManage
 * - InvoiceDetailContent: transfer action absent when conditions not met
 * - InvoiceDetailContent: onTransferred called via action's onSuccess
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceMobileCard } from "../invoice-mobile-card";
import { InvoiceDetailContent } from "../invoice-detail-content";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string) =>
      namespace ? `${namespace}.${key}` : key,
  useLocale: () => "en",
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

// InvoiceForm, InvoiceAttachments, fetchTagsClient not under test here.
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
    id: "inv-test-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-05-01",
    recipient_name: "Supplier Co",
    recipient_address: null,
    notes: null,
    items: [{ description: "Paint", quantity: 2, unit_price: 50, total: 100 }],
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

// ── InvoiceMobileCard tests ───────────────────────────────────────────────────

describe("InvoiceMobileCard — refund arrow and stamps", () => {
  const formatAmount = (n: number) => `${n} €`;

  it("renders arrow label with payment method and company name when refundable_status set", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({
          payment_method_label: "CB - TRUNG",
          refundable_status: "refundable",
        })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="TVA VERIFY SAS"
      />,
    );

    expect(screen.getByText(/CB - TRUNG → TVA VERIFY SAS/)).toBeDefined();
  });

  it("renders arrow without payment method label when label is null", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ payment_method_label: null, refundable_status: "refundable" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="TVA VERIFY SAS"
      />,
    );

    expect(screen.getByText(/→ TVA VERIFY SAS/)).toBeDefined();
  });

  it("does NOT render arrow when refundable_status is null", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ payment_method_label: "CB - TRUNG", refundable_status: null })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="TVA VERIFY SAS"
      />,
    );

    expect(screen.queryByText(/→ TVA VERIFY SAS/)).toBeNull();
  });

  it("renders 'refundable' stamp with plain stamp class", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ refundable_status: "refundable" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="Co"
      />,
    );

    const stamp = screen.getByText("invoices.refund.status.refundable");
    expect(stamp.className).toBe("stamp");
  });

  it("renders 'refund_pending' stamp with warning class", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ refundable_status: "refund_pending" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="Co"
      />,
    );

    const stamp = screen.getByText("invoices.refund.status.refundPending");
    expect(stamp.className).toBe("stamp warning");
  });

  it("renders 'refunded' stamp with positive class", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ refundable_status: "refunded" })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="Co"
      />,
    );

    const stamp = screen.getByText("invoices.refund.status.refunded");
    expect(stamp.className).toBe("stamp positive");
  });

  it("does NOT render any refund stamp when refundable_status is null", () => {
    render(
      <InvoiceMobileCard
        invoice={makeInvoice({ refundable_status: null })}
        isOpen={false}
        onToggle={vi.fn()}
        formatAmount={formatAmount}
        companyName="Co"
      />,
    );

    expect(screen.queryByText("invoices.refund.status.refundable")).toBeNull();
    expect(screen.queryByText("invoices.refund.status.refundPending")).toBeNull();
    expect(screen.queryByText("invoices.refund.status.refunded")).toBeNull();
  });
});

// ── InvoiceDetailContent — transfer action visibility ─────────────────────────

import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";

describe("InvoiceDetailContent — transfer action in detail view", () => {
  const mockSetRefundableStatus = vi.mocked(setRefundableStatus);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows transfer action for M&S + null status + canManage=true", async () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "materials_services", refundable_status: null })}
        canManage
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onTransferred={vi.fn()}
        printUrl="/print"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
      ).not.toBeNull();
    });
  });

  it("does NOT show transfer action when canManage=false", async () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "materials_services", refundable_status: null })}
        canManage={false}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
      ).toBeNull();
    });
  });

  it("does NOT show transfer action when refundable_status is already set", async () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "materials_services", refundable_status: "refundable" })}
        canManage
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
      ).toBeNull();
    });
  });

  it("does NOT show transfer action for non-M&S type", async () => {
    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "labor", refundable_status: null })}
        canManage
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        printUrl="/print"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
      ).toBeNull();
    });
  });

  it("calls setRefundableStatus('refundable') and fires onTransferred on click", async () => {
    mockSetRefundableStatus.mockResolvedValue(undefined);
    const onTransferred = vi.fn();

    render(
      <InvoiceDetailContent
        invoice={makeInvoice({ type: "materials_services", refundable_status: null })}
        canManage
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onTransferred={onTransferred}
        printUrl="/print"
      />,
    );

    const btn = await waitFor(() =>
      screen.getByRole("button", { name: "invoices.refund.action.transfer" }),
    );

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSetRefundableStatus).toHaveBeenCalledWith("inv-test-1", "refundable");
      expect(onTransferred).toHaveBeenCalled();
    });
  });
});
