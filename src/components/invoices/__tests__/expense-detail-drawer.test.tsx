/**
 * Tests for ExpenseDetailDrawer (Expense redesign phase 03) — the right-side
 * detail drawer for the Timeline/Category views.
 *
 * `InvoiceDetailRow` is mocked (it does its own fetch — covered elsewhere by
 * invoice-detail-content tests) so these tests focus on the drawer's own
 * chrome: open/close wiring, Esc, backdrop click, and body scroll-lock.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { ExpenseDetailDrawer } from "../expense-detail-drawer";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("../invoice-detail-row", () => ({
  InvoiceDetailRow: ({ invoiceId }: { invoiceId: string }) => (
    <div data-testid="invoice-detail-row">{invoiceId}</div>
  ),
}));

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  released_funds: "stamp sage",
  labor: "stamp accent",
  materials_services: "stamp olive",
  others: "stamp ochre",
  return: "stamp amber",
};

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0042",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
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

function renderDrawer(invoice: Invoice | null, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <ExpenseDetailDrawer
        invoice={invoice}
        projectId="proj-1"
        canManageInvoices
        companyName="ACME"
        typeStampClass={TYPE_STAMP_CLASS}
        onMutated={vi.fn()}
        onClose={onClose}
      />
    ),
  };
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("ExpenseDetailDrawer", () => {
  it("renders nothing when invoice is null", () => {
    const { container } = renderDrawer(null);
    expect(container.innerHTML).toBe("");
  });

  it("opens with the invoice's number/type and mounts the detail surface", () => {
    renderDrawer(makeInvoice({ invoice_number: "INV-2026-0099" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("INV-2026-0099")).toBeDefined();
    expect(screen.getByTestId("invoice-detail-row")).toBeDefined();
  });

  it("shows the Auto stamp only for auto-generated invoices", () => {
    const { rerender } = render(
      <ExpenseDetailDrawer
        invoice={makeInvoice({ is_auto_generated: true })}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        onMutated={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("invoices.auto")).toBeDefined();

    rerender(
      <ExpenseDetailDrawer
        invoice={makeInvoice({ is_auto_generated: false })}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        onMutated={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText("invoices.auto")).toBeNull();
  });

  it("locks body scroll while open and restores it on close/unmount", () => {
    const { rerender } = render(
      <ExpenseDetailDrawer
        invoice={makeInvoice()}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        onMutated={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <ExpenseDetailDrawer
        invoice={null}
        projectId="proj-1"
        canManageInvoices
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        onMutated={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    renderDrawer(makeInvoice(), onClose);
    // The panel's own close button is the second close-labeled element
    // (the backdrop button is the first, rendered before the panel).
    const [, panelCloseButton] = screen.getAllByLabelText("invoices.drawer.close");
    fireEvent.click(panelCloseButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on backdrop click", () => {
    const onClose = vi.fn();
    renderDrawer(makeInvoice(), onClose);
    // The backdrop is the first close-labeled button, rendered before the
    // dialog panel's own close button in DOM order.
    const [backdropButton] = screen.getAllByLabelText("invoices.drawer.close");
    fireEvent.click(backdropButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape when no other dialog is open", () => {
    const onClose = vi.fn();
    renderDrawer(makeInvoice(), onClose);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when a nested dialog (e.g. export) is open", () => {
    const onClose = vi.fn();
    renderDrawer(makeInvoice(), onClose);
    const nested = document.createElement("div");
    nested.setAttribute("role", "dialog");
    nested.setAttribute("data-state", "open");
    document.body.appendChild(nested);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(nested);
  });

  it("is hidden below lg via the wrapping class", () => {
    const { container } = renderDrawer(makeInvoice());
    expect(container.querySelector(".hidden.lg\\:block")).not.toBeNull();
  });
});
