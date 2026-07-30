/**
 * Tests for ExpenseRow — the grouped desktop list's row (timeline/category views).
 *
 * Covers what used to live in the flat table (now removed):
 * - Payment method label localization ("Cash" → builtin key), custom labels
 *   pass through verbatim, em-dash fallback when absent
 * - Refund-tracked arrow ("label → Company" / "→ Company")
 * - Auto-generated + refund-status stamps
 * - Negative amount renders with the destructive class
 * - Date cell: timeline shows day + weekday, category shows the full date
 * - Keyboard activation (Enter/Space) calls onOpen, same as a click
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpenseRow } from "../expense-row";
import type { Invoice, InvoiceType } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    if (key === "refundOf" && values) return `Return of ${values.number}`;
    return namespace ? `${namespace}.${key}` : key;
  },
  useLocale: () => "en",
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
    invoice_number: "INV-2026-0099",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier X",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1200,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...overrides,
  };
}

describe("ExpenseRow — payment method cell", () => {
  it("localizes the built-in 'Cash' label", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ payment_method_label: "Cash" })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("paymentMethods.builtins.cash")).toBeDefined();
  });

  it("renders a custom label verbatim", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ payment_method_label: "Wire transfer" })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("Wire transfer")).toBeDefined();
  });

  it("renders an em-dash when payment_method_label is null", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ payment_method_label: null })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("—")).toBeDefined();
  });

  it("renders 'label → Company' for refund-tracked rows with a company name", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({
          payment_method_label: "CB - TRUNG",
          refundable_status: "refundable",
        })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName="ANN ECO CONSTRUCTION"
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("CB - TRUNG → ANN ECO CONSTRUCTION")).toBeDefined();
  });

  it("renders '→ Company' when refund-tracked but no payment method label", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ payment_method_label: null, refundable_status: "refundable" })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName="ANN ECO CONSTRUCTION"
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("→ ANN ECO CONSTRUCTION")).toBeDefined();
  });
});

describe("ExpenseRow — recipient cell stamps", () => {
  it("shows the Auto stamp for is_auto_generated invoices", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ is_auto_generated: true })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("invoices.auto")).toBeDefined();
  });

  it("shows the refund-status stamp when refundable_status is set", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ refundable_status: "refund_pending" })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("invoices.refund.status.refundPending")).toBeDefined();
  });
});

describe("ExpenseRow — type stamp", () => {
  it("applies the injected typeStampClass mapping", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ type: "return" })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    const stamp = screen.getByText("invoices.types.return");
    expect(stamp.className).toBe("stamp amber");
  });
});

describe("ExpenseRow — amount cell", () => {
  it("renders negative total_amount with the destructive class", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ type: "return", total_amount: -150 })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    const amount = screen.getByText(/-150,00/);
    expect(amount.className).toContain("text-destructive");
  });

  it("does not apply the destructive class to a positive amount", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ total_amount: 300 })}
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    const amount = screen.getByText(/300,00/);
    expect(amount.className).not.toContain("text-destructive");
  });
});

describe("ExpenseRow — date cell", () => {
  it("timeline variant shows the day number and uppercase weekday", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ issue_date: "2026-06-01" })} // Monday
        variant="timeline"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("01")).toBeDefined();
    expect(screen.getByText("MON")).toBeDefined();
  });

  it("category variant shows the full dd/mm/yyyy date, no weekday", () => {
    render(
      <ExpenseRow
        invoice={makeInvoice({ issue_date: "2026-06-01" })}
        variant="category"
        isOpen={false}
        onOpen={vi.fn()}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    expect(screen.getByText("01/06/2026")).toBeDefined();
    expect(screen.queryByText("MON")).toBeNull();
  });
});

describe("ExpenseRow — interaction", () => {
  it("calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    render(
      <ExpenseRow
        invoice={makeInvoice()}
        variant="timeline"
        isOpen={false}
        onOpen={onOpen}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen on Enter and Space keydown", () => {
    const onOpen = vi.fn();
    render(
      <ExpenseRow
        invoice={makeInvoice()}
        variant="timeline"
        isOpen={false}
        onOpen={onOpen}
        companyName={null}
        typeStampClass={TYPE_STAMP_CLASS}
        regionId="detail-1"
      />
    );

    const row = screen.getByRole("button");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
