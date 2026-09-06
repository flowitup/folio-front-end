/**
 * Tests for InvoiceForm — released_funds "company cash advance" flag
 *
 * Covers:
 * - checkbox renders only when type === "released_funds"
 * - checkbox disappears (and the flag resets) after switching to another type
 * - submit sends is_cash_advance: true for a released_funds row when checked
 * - is_cash_advance is omitted from the payload for other types
 * - edit preselects the checkbox from initialValues.is_cash_advance
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      type: "Type",
      "types.released_funds": "Released Funds",
      "types.labor": "Labor",
      "types.materials_services": "Materials & Services",
      "types.others": "Others",
      "types.return": "Return",
      issueDate: "Issue date",
      recipient: "Recipient",
      recipientAddress: "Address",
      notes: "Notes",
      items: "items",
      addItem: "Add item",
      description: "Description",
      quantity: "Qty",
      unitPrice: "Unit price",
      vatRate: "TVA %",
      total: "Total",
      totalAmount: "totalAmount",
      save: "Save",
      saving: "Saving...",
      "cashAdvance.label": "Company cash advance",
      "cashAdvance.hint": "Money the company handed over",
      errorRecipientRequired: "Recipient name is required",
      errorAtLeastOneItem: "At least one item is required",
      errorDescriptionRequired: "Description is required",
      errorQuantityPositive: "Quantity must be greater than 0",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => null,
}));

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText("Recipient"), {
    target: { value: "ANN ECO CONSTRUCTION → CASH Trung" },
  });
  const descInput = screen.getAllByPlaceholderText(/description/i)[0];
  fireEvent.change(descInput, { target: { value: "Cash advance" } });
}

describe("InvoiceForm — company cash advance flag", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it("shows the checkbox only for released_funds", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "released_funds" }} />);
    expect(screen.getByTestId("cash-advance-checkbox")).toBeDefined();
    expect(screen.getByText("Company cash advance")).toBeDefined();
  });

  it("hides the checkbox for expense types", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "others" }} />);
    expect(screen.queryByTestId("cash-advance-checkbox")).toBeNull();
  });

  it("hides the checkbox after switching away from released_funds", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "released_funds" }} />);
    fireEvent.click(screen.getByTestId("cash-advance-checkbox"));
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "others" } });
    expect(screen.queryByTestId("cash-advance-checkbox")).toBeNull();
  });

  it("submits is_cash_advance: true for a checked released_funds row", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "released_funds" }} />);
    fillRequired();
    fireEvent.click(screen.getByTestId("cash-advance-checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.type).toBe("released_funds");
    expect(payload.is_cash_advance).toBe(true);
  });

  it("submits is_cash_advance: false for an unchecked released_funds row", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "released_funds" }} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.is_cash_advance).toBe(false);
  });

  it("omits is_cash_advance from the payload for other types", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "others" }} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const payload = mockOnSubmit.mock.calls[0][0];
    expect("is_cash_advance" in payload).toBe(false);
  });

  it("preselects the checkbox from initialValues on edit", () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "released_funds", is_cash_advance: true }}
        editingInvoiceId="inv-1"
      />
    );
    expect((screen.getByTestId("cash-advance-checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
