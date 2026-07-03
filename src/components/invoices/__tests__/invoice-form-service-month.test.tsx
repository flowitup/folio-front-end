/**
 * Tests for InvoiceForm — labor "payment for month" (service_month) field
 *
 * Covers:
 * - month input renders when type === "labor"
 * - month input is absent for other invoice types
 * - submit maps "2026-06" → "2026-06-01" in the payload
 * - empty month input omits/nulls service_month in the payload
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

// ── Mock next-intl ─────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      type: "Type",
      "types.released_funds": "Released Funds",
      "types.labor": "Labor",
      "types.materials_services": "Materials & Services",
      "types.others": "Others",
      "types.refund": "Refund",
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
      serviceMonth: "Payment for month",
      errorRecipientRequired: "Recipient name is required",
      errorAtLeastOneItem: "At least one item is required",
      errorDescriptionRequired: "Description is required",
      errorQuantityPositive: "Quantity must be greater than 0",
      errorServiceMonthNotAllowed: "Payment for month can only be set on labor expenses.",
      "select.label": "Select tag",
    };
    return map[key] ?? key;
  },
}));

// ── Mock PaymentMethodSelect and TagSelect (not relevant here) ────────────────

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => null,
}));

vi.mock("@/components/tags/tag-select", () => ({
  TagSelect: () => null,
}));

describe("InvoiceForm — service_month field", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it("shows the month input when type is labor", () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );
    expect(screen.getByTestId("service-month-input")).toBeDefined();
    expect(screen.getByText("Payment for month")).toBeDefined();
  });

  it("does not show the month input for non-labor types", () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "materials_services" }}
      />
    );
    expect(screen.queryByTestId("service-month-input")).toBeNull();
  });

  it("hides the month input after switching away from labor", () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );
    expect(screen.getByTestId("service-month-input")).toBeDefined();

    const typeSelect = screen.getByRole("combobox");
    fireEvent.change(typeSelect, { target: { value: "others" } });

    expect(screen.queryByTestId("service-month-input")).toBeNull();
  });

  it('maps "2026-06" to "2026-06-01" in the submitted payload', async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );

    const recipientInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(recipientInput, { target: { value: "Worker Co" } });

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    const monthInput = screen.getByTestId("service-month-input");
    fireEvent.change(monthInput, { target: { value: "2026-06" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.service_month).toBe("2026-06-01");
  });

  it("submits null service_month when the month field is left empty", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );

    const recipientInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(recipientInput, { target: { value: "Worker Co" } });

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.service_month).toBeNull();
  });

  it("does not include service_month in the payload for non-labor types", async () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "materials_services" }}
      />
    );

    const recipientInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(recipientInput, { target: { value: "Supplier" } });

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "Materials" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.service_month).toBeUndefined();
  });

  it("pre-fills the month input from initialValues.service_month", () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "labor", service_month: "2026-03-01" }}
      />
    );
    const monthInput = screen.getByTestId("service-month-input") as HTMLInputElement;
    expect(monthInput.value).toBe("2026-03");
  });
});
