/**
 * Tests for InvoiceForm — labor "payment for month" (service_month) field
 *
 * Covers:
 * - month input renders when type === "labor"
 * - month input is absent for other invoice types
 * - submit maps "2026-06" → "2026-06-01" in the payload
 * - empty month blocks submission for a NEW labor invoice (required)
 * - empty month is still allowed when editing a legacy labor invoice
 * - service_month omitted from the payload for non-labor types
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
      "types.refund": "Return",
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
      serviceMonthRequired: "Payment for month is required for labor expenses.",
      workerPicker: "Worker",
      workerNotLinked: "Not linked",
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

    // The first combobox is always the type selector — the worker picker
    // (also a <select>, hence also role="combobox") renders alongside it.
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "others" } });

    expect(screen.queryByTestId("service-month-input")).toBeNull();
  });

  it('maps "2026-06" to "2026-06-01" in the submitted payload', async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );

    // New + labor + unlinked worker picker: the free-text recipient is
    // required too (see invoice-form-unlinked-labor-recipient.test.tsx).
    fireEvent.change(screen.getByTestId("unlinked-labor-recipient-input"), {
      target: { value: "June Worker" },
    });

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

  it("marks the month input required for a NEW labor invoice and blocks submission when empty", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} />
    );

    // required is set client-side; the browser's own constraint validation
    // stops the submit event before React's handler runs (same behavior the
    // recipient field already relies on elsewhere in this form).
    const monthInput = screen.getByTestId("service-month-input");
    expect(monthInput).toBeRequired();

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitBtn);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("does not mark the month input required when editing an existing labor invoice", () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "labor" }}
        editingInvoiceId="inv-legacy"
      />
    );
    expect(screen.getByTestId("service-month-input")).not.toBeRequired();
  });

  it("submits null service_month when editing a legacy labor invoice with an empty month", async () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "labor", recipient_name: "Worker Co" }}
        editingInvoiceId="inv-legacy"
      />
    );

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
