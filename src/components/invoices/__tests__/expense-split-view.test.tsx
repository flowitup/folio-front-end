/**
 * Tests for ExpenseSplitView (Expense redesign phase 03) — master-detail
 * "split" view.
 *
 * `InvoiceDetailRow` is mocked (own fetch, covered elsewhere) so these tests
 * focus on: default selection, click-to-swap (no URL touch), `?invoice=`
 * hydration-once, and the empty states.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import { ExpenseSplitView } from "../expense-split-view";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("../invoice-detail-row", () => ({
  InvoiceDetailRow: ({ invoiceId }: { invoiceId: string }) => (
    <div data-testid="invoice-detail-row">{invoiceId}</div>
  ),
}));

const mockReplace = vi.fn();
let mockSearchParamsValue = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => "/en/projects/proj-1/invoices",
  useSearchParams: () => new URLSearchParams(mockSearchParamsValue),
}));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier A",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1000,
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

afterEach(() => {
  cleanup();
  mockReplace.mockClear();
  mockSearchParamsValue = "";
});

describe("ExpenseSplitView — default selection", () => {
  it("selects the first (date-desc) row by default", () => {
    render(
      <ExpenseSplitView
        invoices={[
          makeInvoice({ id: "older", issue_date: "2026-05-01", recipient_name: "Older" }),
          makeInvoice({ id: "newer", issue_date: "2026-06-15", recipient_name: "Newer" }),
        ]}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        onMutated={vi.fn()}
      />
    );
    expect(screen.getByTestId("invoice-detail-row").textContent).toBe("newer");
  });

  it("shows the empty-selection placeholder when there are no invoices", () => {
    render(
      <ExpenseSplitView
        invoices={[]}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        onMutated={vi.fn()}
      />
    );
    expect(screen.queryByTestId("invoice-detail-row")).toBeNull();
    expect(screen.getByText("invoices.split.selectPrompt")).toBeDefined();
  });
});

describe("ExpenseSplitView — click swaps selection locally", () => {
  it("swaps the detail panel without touching the URL", () => {
    render(
      <ExpenseSplitView
        invoices={[
          makeInvoice({ id: "a", issue_date: "2026-06-15", recipient_name: "Alpha Co" }),
          makeInvoice({ id: "b", issue_date: "2026-06-10", recipient_name: "Beta Co" }),
        ]}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        onMutated={vi.fn()}
      />
    );
    // "a" is selected by default (most recent).
    expect(screen.getByTestId("invoice-detail-row").textContent).toBe("a");

    fireEvent.click(screen.getByText("Beta Co"));
    expect(screen.getByTestId("invoice-detail-row").textContent).toBe("b");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("ExpenseSplitView — ?invoice= hydration", () => {
  it("seeds the initial selection from the URL once, then strips the param", () => {
    mockSearchParamsValue = "invoice=b";
    render(
      <ExpenseSplitView
        invoices={[
          makeInvoice({ id: "a", issue_date: "2026-06-15" }),
          makeInvoice({ id: "b", issue_date: "2026-06-10" }),
        ]}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        onMutated={vi.fn()}
      />
    );
    expect(screen.getByTestId("invoice-detail-row").textContent).toBe("b");
    expect(mockReplace).toHaveBeenCalledWith("/en/projects/proj-1/invoices", { scroll: false });
  });

  it("falls back to the first row when the URL id isn't in the list, and strips the stale param", () => {
    mockSearchParamsValue = "invoice=missing";
    render(
      <ExpenseSplitView
        invoices={[
          makeInvoice({ id: "a", issue_date: "2026-06-15" }),
          makeInvoice({ id: "b", issue_date: "2026-06-10" }),
        ]}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        onMutated={vi.fn()}
      />
    );
    expect(screen.getByTestId("invoice-detail-row").textContent).toBe("a");
    // The dead `?invoice=missing` param must not survive — otherwise a later
    // variant switch would resolve it against the unfiltered list and pop
    // the drawer open for an invoice the user never selected (M1).
    expect(mockReplace).toHaveBeenCalledWith("/en/projects/proj-1/invoices", { scroll: false });
  });
});
