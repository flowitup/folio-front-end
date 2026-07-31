/**
 * Tests for ExpenseDetailDrawer (Expense redesign phase 03) — the right-side
 * detail drawer for the Timeline/Category views.
 *
 * `InvoiceDetailRow` is mocked (it does its own fetch — covered elsewhere by
 * invoice-detail-content tests) so these tests focus on the drawer's own
 * chrome: open/close wiring, Esc, backdrop click, and body scroll-lock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
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

/**
 * Controllable `window.matchMedia` stub for `(min-width: 1024px)` — lets
 * tests simulate desktop vs. mobile viewports and fire the `change` event
 * the drawer listens for on resize.
 */
function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: "(min-width: 1024px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (event: string, cb: (e: MediaQueryListEvent) => void) => {
      if (event === "change") listeners.add(cb);
    },
    removeEventListener: (event: string, cb: (e: MediaQueryListEvent) => void) => {
      if (event === "change") listeners.delete(cb);
    },
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
}

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

// Default to desktop for every test unless a test overrides it — matches
// this drawer's real usage (it never mounts below `lg` in the first place).
beforeEach(() => {
  mockMatchMedia(true);
});

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

});

describe("ExpenseDetailDrawer — desktop-only mount (H1)", () => {
  it("does not mount and does not lock body scroll when the viewport is below lg", () => {
    mockMatchMedia(false);
    const { container } = renderDrawer(makeInvoice());
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("expense-detail-drawer")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("mounts and locks body scroll once the viewport crosses into desktop", () => {
    const media = mockMatchMedia(false);
    renderDrawer(makeInvoice());
    expect(screen.queryByTestId("expense-detail-drawer")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    act(() => media.setMatches(true));

    expect(screen.getByTestId("expense-detail-drawer")).toBeDefined();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("unmounts and releases the scroll-lock on a desktop→mobile resize", () => {
    const media = mockMatchMedia(true);
    renderDrawer(makeInvoice());
    expect(screen.getByTestId("expense-detail-drawer")).toBeDefined();
    expect(document.body.style.overflow).toBe("hidden");

    act(() => media.setMatches(false));

    expect(screen.queryByTestId("expense-detail-drawer")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("ExpenseDetailDrawer — focus management (M3)", () => {
  it("focuses the close button on open and restores focus to the trigger on close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open row";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

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

    const [, panelCloseButton] = screen.getAllByLabelText("invoices.drawer.close");
    expect(document.activeElement).toBe(panelCloseButton);

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

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
