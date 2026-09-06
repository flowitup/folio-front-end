/**
 * invoice-form-avoir-link.test.tsx
 *
 * Tests for the "Settled via" / "Applied to invoice" avoir-link controls in
 * InvoiceForm (type=return only):
 * - "Applied to invoice" picker hidden by default (cash), revealed on avoir
 * - Picker cleared + hidden again when switching back to cash
 * - Picking a target shows the payment-method-alignment hint (with label when
 *   the target carries a payment_method_label, generic text otherwise)
 * - Submitted payload carries settled_via + applied_to_invoice_id only for
 *   type=return; untouched settled_via stays null
 * - Cap error (AppliedExceedsTarget 400) rendered inline as the localized
 *   "avoir exceeds target total" message
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "../invoice-form";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      "type": "Type",
      "types.released_funds": "Released Funds",
      "types.labor": "Labor",
      "types.materials_services": "Materials & Services",
      "types.others": "Others",
      "types.return": "Return",
      "issueDate": "Issue Date",
      "recipient": "Recipient",
      "recipientAddress": "Address",
      "notes": "Notes",
      "items": "Line Items",
      "addItem": "Add Item",
      "description": "Description",
      "quantity": "Qty",
      "unitPrice": "Unit Price",
      "vatRate": "TVA %",
      "total": "Total",
      "totalAmount": "Total",
      "save": "Save",
      "saving": "Saving...",
      "errorRecipientRequired": "Recipient name is required",
      "errorAtLeastOneItem": "At least one item is required",
      "errorDescriptionRequired": "Description is required",
      "errorQuantityPositive": "Quantity must be greater than 0",
      "refundHint": "Use a negative unit price for a credit/refund line.",
      "refundsInvoiceLabel": "Refunds invoice (Materials & Services)",
      "refundsInvoiceNone": "— none —",
      "settledVia.label": "Settled via",
      "settledVia.cash": "Cash refund",
      "settledVia.avoir": "Avoir (supplier credit)",
      "appliedToInvoiceLabel": "Applied to invoice",
      "appliedToInvoiceNone": "— none —",
      "appliedToMethodHint": "The return's payment method will follow the selected invoice's method.",
      "appliedToMethodHintWithLabel": values
        ? `The return's payment method will follow the selected invoice's method (${values.label}).`
        : "The return's payment method will follow the selected invoice's method ({label}).",
      "errorAppliedExceedsTarget": "The avoir amount exceeds the target invoice's total.",
      // paymentMethods.builtins namespace passthrough
      "cash": "Cash",
    };

    const full = namespace ? `${namespace}.${key}` : key;
    return (
      translations[key] ??
      translations[full] ??
      (values
        ? Object.entries(values).reduce(
            (s, [k, v]) => s.replace(`{${k}}`, String(v)),
            key
          )
        : key)
    );
  },
}));

// Mock invoice-api — fetchInvoicesWithMeta returns the project's invoice list
vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
}));

import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";

const mockFetchInvoices = vi.mocked(fetchInvoicesWithMeta);

// Stub PaymentMethodSelect (not under test)
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => <div data-testid="payment-method-select" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvoice(
  id: string,
  number: string,
  total: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    project_id: "proj-1",
    invoice_number: number,
    type: "materials_services" as const,
    issue_date: "2026-01-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Item", quantity: 1, unit_price: total, total }],
    total_amount: total,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

function emptyMetaResponse(invoices: ReturnType<typeof makeInvoice>[] = []) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoices: invoices as any,
    total: invoices.length,
    funds_released_total: 0,
    funds_released_company_total: 0,
    funds_released_personal_total: 0,
    company_spent_total: 0,
    personal_spent_total: 0,
    company_name: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoiceForm — settled via / applied-to-invoice picker visibility", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse());
  });

  it("defaults to cash: applied-to picker hidden, settled-via select shows cash", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    expect((settledVia as HTMLSelectElement).value).toBe("cash");
    expect(screen.queryByTestId("applied-to-invoice-select")).toBeNull();
  });

  it("reveals the applied-to picker when avoir is selected", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });

    await waitFor(() => {
      expect(screen.getByTestId("applied-to-invoice-select")).toBeDefined();
    });
  });

  it("hides + clears the applied-to picker when switching back to cash", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300);
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([ms1]));

    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });

    const picker = await screen.findByTestId("applied-to-invoice-select");
    await userEvent.selectOptions(picker as HTMLSelectElement, "ms-1");
    expect((picker as HTMLSelectElement).value).toBe("ms-1");

    fireEvent.change(settledVia, { target: { value: "cash" } });
    await waitFor(() => {
      expect(screen.queryByTestId("applied-to-invoice-select")).toBeNull();
    });

    // Re-opening avoir starts from an empty selection again (state was cleared).
    fireEvent.change(settledVia, { target: { value: "avoir" } });
    const reopenedPicker = await screen.findByTestId("applied-to-invoice-select");
    expect((reopenedPicker as HTMLSelectElement).value).toBe("");
  });

  it("lists non-return/released_funds invoices in the applied-to picker", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300);
    const labor1 = makeInvoice("lab-1", "LAB-001", 200, { type: "labor" });
    const ret1 = makeInvoice("ret-1", "RET-001", -50, { type: "return" });
    const released1 = makeInvoice("rf-1", "RF-001", 1000, { type: "released_funds" });
    mockFetchInvoices.mockResolvedValue(
      emptyMetaResponse([ms1, labor1, ret1, released1])
    );

    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });

    const picker = await screen.findByTestId("applied-to-invoice-select");
    await waitFor(() => {
      expect(within(picker as HTMLElement).getByText(/INV-001/)).toBeDefined();
      expect(within(picker as HTMLElement).getByText(/LAB-001/)).toBeDefined();
      expect(within(picker as HTMLElement).queryByText(/RET-001/)).toBeNull();
      expect(within(picker as HTMLElement).queryByText(/RF-001/)).toBeNull();
    });
  });
});

describe("InvoiceForm — applied-to method-alignment hint", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it("shows the generic hint when the target has no payment_method_label", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300, { payment_method_label: null });
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([ms1]));

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });

    const picker = await screen.findByTestId("applied-to-invoice-select");
    await user.selectOptions(picker as HTMLSelectElement, "ms-1");

    const hint = await screen.findByTestId("applied-to-method-hint");
    expect(hint.textContent).toContain("The return's payment method will follow the selected invoice's method.");
  });

  it("shows the target's payment method label when present", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300, { payment_method_label: "CB - TRUNG" });
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([ms1]));

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });

    const picker = await screen.findByTestId("applied-to-invoice-select");
    await user.selectOptions(picker as HTMLSelectElement, "ms-1");

    const hint = await screen.findByTestId("applied-to-method-hint");
    expect(hint.textContent).toContain("CB - TRUNG");
  });

  it("hint absent until a target is picked", async () => {
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([makeInvoice("ms-1", "INV-001", 300)]));

    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });
    await screen.findByTestId("applied-to-invoice-select");

    expect(screen.queryByTestId("applied-to-method-hint")).toBeNull();
  });
});

describe("InvoiceForm — submitted payload", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it("carries settled_via='avoir' + applied_to_invoice_id when a target is picked", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300);
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([ms1]));

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });
    const picker = await screen.findByTestId("applied-to-invoice-select");
    await user.selectOptions(picker as HTMLSelectElement, "ms-1");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settled_via).toBe("avoir");
    expect(payload.applied_to_invoice_id).toBe("ms-1");
  });

  it("carries settled_via='cash' and null applied_to_invoice_id when cash is explicitly picked", async () => {
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse());

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    const settledVia = await screen.findByTestId("settled-via-select");
    // Explicitly touch the select (even re-picking "cash") to simulate a user choice.
    fireEvent.change(settledVia, { target: { value: "avoir" } });
    fireEvent.change(settledVia, { target: { value: "cash" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settled_via).toBe("cash");
    expect(payload.applied_to_invoice_id).toBeNull();
  });

  it("stays null when the user never touches the settled-via select (existing-row safety)", async () => {
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse());

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    // Don't touch the settled-via select at all.
    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settled_via).toBeNull();
    expect(payload.applied_to_invoice_id).toBeNull();
  });

  it("preserves the existing avoir link on edit-load without the user touching anything", async () => {
    const ms1 = makeInvoice("ms-1", "INV-001", 300);
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([ms1]));

    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{
          type: "return",
          recipient_name: "Supplier",
          items: [{ description: "Credit note", quantity: 1, unit_price: -300, vat_rate: 0 }],
          settled_via: "avoir",
          applied_to_invoice_id: "ms-1",
        }}
        projectId="proj-1"
        editingInvoiceId="ret-1"
      />
    );

    const settledVia = await screen.findByTestId("settled-via-select");
    expect((settledVia as HTMLSelectElement).value).toBe("avoir");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.settled_via).toBe("avoir");
    expect(payload.applied_to_invoice_id).toBe("ms-1");
  });

  it("omits settled_via/applied_to_invoice_id for non-return types", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "materials_services" }} />);

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Item");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty("settled_via");
    expect(payload).not.toHaveProperty("applied_to_invoice_id");
  });
});

describe("InvoiceForm — cap error (AppliedExceedsTarget)", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchInvoices.mockResolvedValue(emptyMetaResponse([makeInvoice("ms-1", "INV-001", 300)]));
  });

  it("renders the localized message inline when the backend returns AppliedExceedsTarget", async () => {
    // Simulate the API error shape: { error: "AppliedExceedsTarget", message, status_code: 400 }
    const capError = Object.assign(new Error("cap exceeded"), {
      data: {
        error: "AppliedExceedsTarget",
        message: "Applied amount exceeds target invoice total. Remaining applicable: 50",
      },
    });
    onSubmit.mockRejectedValueOnce(capError);

    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "return" }} projectId="proj-1" />);

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    const settledVia = await screen.findByTestId("settled-via-select");
    fireEvent.change(settledVia, { target: { value: "avoir" } });
    const picker = await screen.findByTestId("applied-to-invoice-select");
    await user.selectOptions(picker as HTMLSelectElement, "ms-1");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // The raw backend message ("Remaining applicable: 50") must NOT leak through —
      // the localized static message is shown instead.
      expect(
        screen.getByText("The avoir amount exceeds the target invoice's total.")
      ).toBeDefined();
      expect(screen.queryByText(/Remaining applicable/i)).toBeNull();
    });
  });
});
