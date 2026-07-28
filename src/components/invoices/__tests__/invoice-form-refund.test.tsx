/**
 * invoice-form-refund.test.tsx
 *
 * Tests for refund-type-specific behaviour in InvoiceForm:
 * - Mixed-sign unit_price allowed for refund + materials_services (no min=0)
 * - Positive-only types keep min=0
 * - Signed values submitted as-is (no negation/abs)
 * - Edit-load populates stored signed values verbatim
 * - Refund link selector appears only for type=refund; "none" option present
 * - Cap error (RefundExceedsSourceError) rendered inline
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
      "types.refund": "Refund",
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
      "refundOf": values ? `Refund of ${values.number}` : "Refund of {number}",
      "errorRefundExceedsSource": values
        ? `Refund exceeds the remaining refundable amount (${values.remaining}) for this invoice.`
        : "Refund exceeds the remaining refundable amount ({remaining}) for this invoice.",
      // tags namespace passthrough
      "select.label": "Phase Tag",
    };

    // Flat key lookup (namespace is stripped from the key in the mock)
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

// Mock invoice-api — fetchInvoicesWithMeta returns a list of M&S invoices
vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
}));

import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";

const mockFetchInvoices = vi.mocked(fetchInvoicesWithMeta);

// Stub PaymentMethodSelect and TagSelect (not under test)
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => <div data-testid="payment-method-select" />,
}));
vi.mock("@/components/tags/tag-select", () => ({
  TagSelect: () => <div data-testid="tag-select" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMsInvoice(id: string, number: string, total: number) {
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
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoiceForm — mixed-sign unit_price gating", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
    // Default: no MS invoices
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });
  });

  it("unit_price input has no min attribute for type=refund", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "refund" }} projectId="proj-1" />);

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    // spinbutton order: quantity(0), unit_price(1), vat_rate(2)
    const unitPriceInput = numInputs[1];
    expect(unitPriceInput.getAttribute("min")).toBeNull();
  });

  it("unit_price input has no min attribute for type=materials_services", async () => {
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "materials_services" }}
      />
    );

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    const unitPriceInput = numInputs[1];
    expect(unitPriceInput.getAttribute("min")).toBeNull();
  });

  it("unit_price input keeps min=0 for type=labor", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "labor" }} />);

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    const unitPriceInput = numInputs[1];
    expect(unitPriceInput.getAttribute("min")).toBe("0");
  });

  it("unit_price input keeps min=0 for type=others", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "others" }} />);

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    const unitPriceInput = numInputs[1];
    expect(unitPriceInput.getAttribute("min")).toBe("0");
  });

  it("unit_price input keeps min=0 for type=released_funds", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "released_funds" }} />);

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    const unitPriceInput = numInputs[1];
    expect(unitPriceInput.getAttribute("min")).toBe("0");
  });

  it("min follows the type's mixed-sign gating (released_funds → refund)", async () => {
    render(<InvoiceForm onSubmit={onSubmit} projectId="proj-1" />);

    // Default type is materials_services — mixed-sign allowed, no min clamp.
    const desktop = screen.getByTestId("invoice-items-desktop");
    expect(within(desktop).getAllByRole("spinbutton")[1].getAttribute("min")).toBeNull();

    // released_funds forbids negative unit prices — min clamps to 0.
    const allSelects = screen.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "released_funds" } });
    await waitFor(() => {
      expect(within(desktop).getAllByRole("spinbutton")[1].getAttribute("min")).toBe("0");
    });

    // refund re-allows mixed sign — min cleared again.
    fireEvent.change(allSelects[0], { target: { value: "refund" } });
    await waitFor(() => {
      expect(within(desktop).getAllByRole("spinbutton")[1].getAttribute("min")).toBeNull();
    });
  });

  it("min restored when switching from refund back to labor", async () => {
    render(
      <InvoiceForm onSubmit={onSubmit} initialValues={{ type: "refund" }} projectId="proj-1" />
    );

    const desktop = screen.getByTestId("invoice-items-desktop");
    let numInputs = within(desktop).getAllByRole("spinbutton");
    expect(numInputs[1].getAttribute("min")).toBeNull();

    // The first combobox is the type selector; others may include the M&S link select
    const allSelects = screen.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "labor" } });

    await waitFor(() => {
      numInputs = within(desktop).getAllByRole("spinbutton");
      expect(numInputs[1].getAttribute("min")).toBe("0");
    });
  });
});

describe("InvoiceForm — signed values submitted as-is", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });
  });

  it("negative unit_price submitted without abs() for refund type", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    // Fill recipient
    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");

    // Set item description
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    // Use fireEvent.change to set a negative value on the number input
    // (userEvent.type doesn't reliably produce negatives on number inputs in jsdom)
    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    fireEvent.change(numInputs[1], { target: { value: "-200" } });

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.items[0].unit_price).toBe(-200);
  });
});

describe("InvoiceForm — edit-load shows stored signed values", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });
  });

  it("populates unit_price with stored negative value (no abs)", () => {
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{
          type: "refund",
          recipient_name: "Supplier",
          items: [
            { description: "Credit note", quantity: 1, unit_price: -200, vat_rate: 0 },
          ],
        }}
        projectId="proj-1"
      />
    );

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    // unit_price is numInputs[1]
    expect(numInputs[1]).toHaveValue(-200);
  });

  it("populates positive unit_price unchanged", () => {
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{
          type: "refund",
          recipient_name: "Supplier",
          items: [
            { description: "Charge", quantity: 1, unit_price: 30, vat_rate: 0 },
          ],
        }}
        projectId="proj-1"
      />
    );

    const desktop = screen.getByTestId("invoice-items-desktop");
    const numInputs = within(desktop).getAllByRole("spinbutton");
    expect(numInputs[1]).toHaveValue(30);
  });
});

describe("InvoiceForm — refund link selector", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it("link selector not shown for type=materials_services", async () => {
    render(
      <InvoiceForm onSubmit={onSubmit} initialValues={{ type: "materials_services" }} />
    );

    expect(screen.queryByTestId("refunds-invoice-select")).toBeNull();
  });

  it("link selector not shown for type=labor", async () => {
    render(<InvoiceForm onSubmit={onSubmit} initialValues={{ type: "labor" }} />);
    expect(screen.queryByTestId("refunds-invoice-select")).toBeNull();
  });

  it("link selector shown for type=refund with a '— none —' option", async () => {
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    const selector = await screen.findByTestId("refunds-invoice-select");
    expect(selector).toBeDefined();
    expect(within(selector as HTMLElement).getByText(/none/i)).toBeDefined();
  });

  it("link selector lists M&S invoices fetched from the API", async () => {
    const ms1 = makeMsInvoice("ms-1", "INV-001", 300);
    const ms2 = makeMsInvoice("ms-2", "INV-002", 150);
    mockFetchInvoices.mockResolvedValue({
      invoices: [ms1, ms2],
      total: 2,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    const selector = await screen.findByTestId("refunds-invoice-select");
    await waitFor(() => {
      expect(within(selector as HTMLElement).getByText(/INV-001/)).toBeDefined();
      expect(within(selector as HTMLElement).getByText(/INV-002/)).toBeDefined();
    });
  });

  it("excludes the editingInvoiceId from the selector list", async () => {
    const ms1 = makeMsInvoice("ms-1", "INV-001", 300);
    const ms2 = makeMsInvoice("ms-2", "INV-002", 150);
    mockFetchInvoices.mockResolvedValue({
      invoices: [ms1, ms2],
      total: 2,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
        editingInvoiceId="ms-1"
      />
    );

    const selector = await screen.findByTestId("refunds-invoice-select");
    await waitFor(() => {
      expect(within(selector as HTMLElement).queryByText(/INV-001/)).toBeNull();
      expect(within(selector as HTMLElement).getByText(/INV-002/)).toBeDefined();
    });
  });

  it("refunds_invoice_id included in payload when linked", async () => {
    const ms1 = makeMsInvoice("ms-1", "INV-001", 300);
    mockFetchInvoices.mockResolvedValue({
      invoices: [ms1],
      total: 1,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    // Fill required fields
    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    // Wait for selector and pick the M&S invoice
    const selector = await screen.findByTestId("refunds-invoice-select");
    await user.selectOptions(selector as HTMLSelectElement, "ms-1");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.refunds_invoice_id).toBe("ms-1");
  });

  it("refunds_invoice_id is null when '— none —' selected", async () => {
    const ms1 = makeMsInvoice("ms-1", "INV-001", 300);
    mockFetchInvoices.mockResolvedValue({
      invoices: [ms1],
      total: 1,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    // Don't change selector — stays at default "none"
    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.refunds_invoice_id).toBeNull();
  });

  it("refund hint text rendered when type=refund", async () => {
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });

    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    expect(await screen.findByText(/negative unit price/i)).toBeDefined();
  });
});

describe("InvoiceForm — cap error (RefundExceedsSourceError)", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchInvoices.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    });
  });

  it("renders cap error inline when backend returns RefundExceedsSourceError", async () => {
    // Simulate the API error shape
    const capError = Object.assign(new Error("cap exceeded"), {
      data: {
        name: "RefundExceedsSourceError",
        message: "Refund exceeds. Remaining: 100",
      },
    });
    onSubmit.mockRejectedValueOnce(capError);

    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        initialValues={{ type: "refund" }}
        projectId="proj-1"
      />
    );

    const textInputs = screen.getAllByRole("textbox");
    await user.type(textInputs[0], "Supplier");
    const descInputs = screen.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Credit note");

    const submitBtn = screen.getByRole("button", { name: /save/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // The error message should be rendered inline
      const errorDiv = screen.getByText(/refund exceeds/i);
      expect(errorDiv).toBeDefined();
    });
  });
});
