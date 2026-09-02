/**
 * Tests for InvoiceHighlightPicker + the highlight-colors helper.
 *
 * Covers:
 * - highlightRowTint: undefined for null/unknown, a tint for a palette color
 * - picker opens, selecting a swatch PATCHes highlight_color and reports the result
 * - "Clear" is disabled when no color is set and enabled + sends null when one is
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceHighlightPicker } from "../invoice-highlight-picker";
import { highlightRowTint, highlightSwatch } from "@/lib/invoices/highlight-colors";
import type { Invoice } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string) =>
      namespace ? `${namespace}.${key}` : key,
}));

vi.mock("@/lib/api/invoice-api", () => ({
  updateInvoice: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { updateInvoice } from "@/lib/api/invoice-api";

const baseInvoice: Invoice = {
  id: "inv-1",
  project_id: "proj-1",
  invoice_number: "INV-2026-0001",
  type: "materials_services",
  issue_date: "2026-09-01",
  recipient_name: "Supplier",
  recipient_address: null,
  notes: null,
  items: [],
  total_amount: 100,
  created_by: "u1",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  payment_method_id: null,
  payment_method_label: null,
  source_billing_document_id: null,
  is_auto_generated: false,
  service_month: null,
  highlight_color: null,
};

describe("highlight-colors helper", () => {
  it("returns undefined for null / unknown colors", () => {
    expect(highlightRowTint(null)).toBeUndefined();
    expect(highlightRowTint(undefined)).toBeUndefined();
    // @ts-expect-error — deliberately passing an off-palette value
    expect(highlightRowTint("chartreuse")).toBeUndefined();
  });

  it("returns a tint + swatch for a palette color", () => {
    expect(highlightRowTint("green")).toMatch(/rgba\(/);
    expect(highlightSwatch("green")).toMatch(/^#/);
  });
});

describe("InvoiceHighlightPicker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selecting a swatch PATCHes highlight_color and reports the result", async () => {
    const updated = { ...baseInvoice, highlight_color: "green" as const };
    vi.mocked(updateInvoice).mockResolvedValue(updated);
    const onUpdated = vi.fn();

    render(<InvoiceHighlightPicker invoice={baseInvoice} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByLabelText("invoices.highlight.label"));
    fireEvent.click(await screen.findByLabelText("invoices.highlight.colors.green"));

    await waitFor(() =>
      expect(updateInvoice).toHaveBeenCalledWith("proj-1", "inv-1", { highlight_color: "green" })
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it("Clear is disabled when no color is set", async () => {
    render(<InvoiceHighlightPicker invoice={baseInvoice} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("invoices.highlight.label"));
    expect(await screen.findByLabelText("invoices.highlight.clear")).toBeDisabled();
  });

  it("Clear sends null when a color is currently set", async () => {
    vi.mocked(updateInvoice).mockResolvedValue({ ...baseInvoice, highlight_color: null });
    const onUpdated = vi.fn();
    render(
      <InvoiceHighlightPicker
        invoice={{ ...baseInvoice, highlight_color: "red" }}
        onUpdated={onUpdated}
      />
    );

    fireEvent.click(screen.getByLabelText("invoices.highlight.label"));
    fireEvent.click(await screen.findByLabelText("invoices.highlight.clear"));

    await waitFor(() =>
      expect(updateInvoice).toHaveBeenCalledWith("proj-1", "inv-1", { highlight_color: null })
    );
  });
});
