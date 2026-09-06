/**
 * Tests for transfer action gating when paid_by_company is set.
 *
 * Direct-prop unit tests (InvoiceDetailContent):
 * - Transfer action hidden when paid_by_company=true
 * - Transfer action shown when paid_by_company=false
 * - Transfer action shown when paid_by_company absent
 * - Transfer action hidden for non-M&S type
 * - Transfer action hidden when canManage=false
 *
 * Fetch-path integration tests (InvoiceDetailRow):
 * - fetchInvoice returning paid_by_company=true → transfer action absent
 * - fetchInvoice returning paid_by_company=false → transfer action present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InvoiceDetailContent } from "../invoice-detail-content";
import { InvoiceDetailRow } from "../invoice-detail-row";
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

import { fetchInvoice as mockFetchInvoice } from "@/lib/api/invoice-api";
const mockFetch = vi.mocked(mockFetchInvoice);

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

// ── Direct-prop unit tests ────────────────────────────────────────────────────

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

// ── Fetch-path integration tests (InvoiceDetailRow → fetchInvoice) ────────────

describe("InvoiceDetailRow — transfer action gated via fetchInvoice response", () => {
  it(
    "transfer action absent when fetchInvoice returns paid_by_company=true",
    async () => {
      mockFetch.mockResolvedValueOnce(
        makeInvoice({ paid_by_company: true }),
      );

      render(
        <table>
          <tbody>
            <InvoiceDetailRow
              projectId="proj-1"
              invoiceId="inv-dc-1"
              canManage={true}
              colSpan={5}
            />
          </tbody>
        </table>,
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("proj-1", "inv-dc-1");
      });

      // Transfer button must not appear
      expect(
        screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
      ).toBeNull();
    },
    15000,
  );

  it(
    "transfer action present when fetchInvoice returns paid_by_company=false",
    async () => {
      mockFetch.mockResolvedValueOnce(
        makeInvoice({ paid_by_company: false }),
      );

      render(
        <table>
          <tbody>
            <InvoiceDetailRow
              projectId="proj-1"
              invoiceId="inv-dc-1"
              canManage={true}
              colSpan={5}
            />
          </tbody>
        </table>,
      );

      await waitFor(
        () => {
          expect(
            screen.queryByRole("button", { name: "invoices.refund.action.transfer" }),
          ).not.toBeNull();
        },
        { timeout: 5000 },
      );
    },
    15000,
  );
});
