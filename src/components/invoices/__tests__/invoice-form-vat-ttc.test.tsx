/**
 * Tests for InvoiceForm — per-line VAT % input and TTC grand total
 *
 * Covers:
 * - vatRate field renders with label
 * - rowTotal and grandTotal are TTC-aware: qty × price × (1 + vat/100)
 * - vat_rate is included in the submitted payload
 * - Legacy items (no vat_rate) default to 0 % VAT — totals unchanged
 *
 * Dual-render note: desktop and mobile wrappers both exist in jsdom.
 * Assertions on computed totals are scoped to data-testid="invoice-items-desktop"
 * to avoid double-counting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "../invoice-form";
import { formatEUR } from "@/lib/utils/formatters";
// formatEUR emits U+202F/U+00A0 spaces; testing-library's default normalizer
// collapses them to ASCII spaces, so match against the normalized string.
const eur = (n: number) => formatEUR(n).replace(/[\u202f\u00a0]/g, " ");


// ── Mock next-intl ─────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      type: "Type",
      "types.released_funds": "Released Funds",
      "types.labor": "Labor",
      "types.materials_services": "Materials & Services",
      "types.others": "Others",
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
      errorRecipientRequired: "Recipient name is required",
      errorAtLeastOneItem: "At least one item is required",
      errorDescriptionRequired: "Description is required",
      errorQuantityPositive: "Quantity must be greater than 0",
      "select.label": "Select tag",
    };
    return map[key] ?? key;
  },
}));

// ── Mock PaymentMethodSelect (not relevant here) ──────────────────────────────

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => null,
}));

describe("InvoiceForm — VAT % field", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it("renders the TVA % label in the desktop header", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} />);
    const desktop = screen.getByTestId("invoice-items-desktop");
    expect(within(desktop).getByText("TVA %")).toBeDefined();
  });

  it("renders a numeric input for vat_rate with default value 0", () => {
    render(<InvoiceForm onSubmit={mockOnSubmit} />);
    const desktop = screen.getByTestId("invoice-items-desktop");
    const vatInputs = within(desktop).getAllByRole("spinbutton");
    // Spinbutton order in desktop: qty(0), unit_price(1), vat_rate(2)
    const vatInput = vatInputs[2];
    expect(vatInput).toBeDefined();
    expect(vatInput).toHaveAttribute("min", "0");
    expect(vatInput).toHaveAttribute("max", "100");
    expect(vatInput).toHaveAttribute("step", "0.1");
  });

  it("computes rowTotal as qty × price × (1 + vat/100)", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={mockOnSubmit} />);

    const desktop = screen.getByTestId("invoice-items-desktop");
    const spinbuttons = within(desktop).getAllByRole("spinbutton");

    // Set qty = 1, price = 100, vat = 20 → TTC = 120.00
    await user.clear(spinbuttons[0]);
    await user.type(spinbuttons[0], "1");

    await user.clear(spinbuttons[1]);
    await user.type(spinbuttons[1], "100");

    await user.clear(spinbuttons[2]);
    await user.type(spinbuttons[2], "20");

    // rowTotal and grandTotal should both show 120.00
    await waitFor(() => {
      expect(within(desktop).queryByText(eur(120))).not.toBeNull();
    });
  });

  it("grandTotal sums TTC across multiple items", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={mockOnSubmit} />);

    const desktop = within(screen.getByTestId("invoice-items-desktop"));

    // First item: qty=1 price=100 vat=10 → 110.00
    const sb1 = desktop.getAllByRole("spinbutton");
    await user.clear(sb1[0]);
    await user.type(sb1[0], "1");
    await user.clear(sb1[1]);
    await user.type(sb1[1], "100");
    await user.clear(sb1[2]);
    await user.type(sb1[2], "10");

    // Add second item
    const addBtn = screen.getByRole("button", { name: /add item/i });
    await user.click(addBtn);

    // Second item: qty=2 price=50 vat=0 → 100.00
    const sb2 = within(screen.getByTestId("invoice-items-desktop")).getAllByRole("spinbutton");
    await user.clear(sb2[3]);
    await user.type(sb2[3], "2");
    await user.clear(sb2[4]);
    await user.type(sb2[4], "50");
    // vat_rate defaults to 0 — leave it

    // Grand total = 110 + 100 = 210,00 €
    await waitFor(() => {
      const grandTotal = screen.queryByText((content) => content.includes(eur(210)));
      expect(grandTotal).not.toBeNull();
    });
  });

  it("includes vat_rate in the submitted payload", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm onSubmit={mockOnSubmit} />);

    // Fill recipient
    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "Client Test");

    const desktop = within(screen.getByTestId("invoice-items-desktop"));
    const descInputs = desktop.getAllByPlaceholderText(/description/i);
    await user.type(descInputs[0], "Service fee");

    const spinbuttons = desktop.getAllByRole("spinbutton");
    await user.clear(spinbuttons[0]);
    await user.type(spinbuttons[0], "1");
    await user.clear(spinbuttons[1]);
    await user.type(spinbuttons[1], "500");
    await user.clear(spinbuttons[2]);
    await user.type(spinbuttons[2], "20");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.items[0].vat_rate).toBe(20);
  });

  it("populates vat_rate from initialValues", () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{
          type: "materials_services",
          recipient_name: "Existing Client",
          items: [{ description: "Gravel", quantity: 5, unit_price: 200, vat_rate: 10 }],
        }}
      />
    );

    const desktop = within(screen.getByTestId("invoice-items-desktop"));
    const spinbuttons = desktop.getAllByRole("spinbutton");
    // Order: qty(0), price(1), vat(2)
    expect(spinbuttons[2]).toHaveValue(10);
  });

  it("treats missing vat_rate as 0 % (legacy item — total unchanged)", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{
          items: [
            // No vat_rate — legacy shape
            { description: "Old item", quantity: 4, unit_price: 25 },
          ],
        }}
      />
    );

    const desktop = within(screen.getByTestId("invoice-items-desktop"));

    // rowTotal should be 4 × 25 = 100.00 (no VAT applied)
    await waitFor(() => {
      expect(desktop.queryByText(eur(100))).not.toBeNull();
    });

    // Fill recipient then submit to verify vat_rate defaults to 0 in payload
    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "Legacy Client");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.items[0].vat_rate).toBe(0);
  });
});
