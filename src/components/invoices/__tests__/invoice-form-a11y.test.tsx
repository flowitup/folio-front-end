/** Icon-only controls of the expense form have an accessible name. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";
import { InvoiceExportDialog } from "../invoice-export-dialog";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

// The real picker's trigger takes the id (see payment-method-select.test.tsx).
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: ({ id }: { id?: string }) => <button type="button" id={id} data-testid="payment-method-trigger" />,
}));

describe("expense form and export dialog accessibility", () => {
  it("names the line-item delete buttons", () => {
    render(<InvoiceForm onSubmit={vi.fn()} />);

    // Desktop row and mobile card of the default line.
    expect(screen.getAllByRole("button", { name: "invoices.removeLine" })).toHaveLength(2);
  });

  it("links each field label to its control", () => {
    render(<InvoiceForm onSubmit={vi.fn()} companyId="co-1" />);

    expect(screen.getByLabelText("invoices.type").tagName).toBe("SELECT");
    expect(screen.getByLabelText("invoices.recipient *")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("invoices.paymentMethod.label")).toBe(screen.getByTestId("payment-method-trigger"));
    expect(screen.getByLabelText("invoices.recipientAddress").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("invoices.notes").tagName).toBe("TEXTAREA");
  });

  it("names the line inputs in both the desktop row and the mobile card", () => {
    render(<InvoiceForm onSubmit={vi.fn()} />);

    for (const name of ["invoices.description", "invoices.quantity", "invoices.unitPrice", "invoices.vatRate"]) {
      expect(screen.getAllByRole("textbox", { name })).toHaveLength(2);
    }
  });

  it("describes the export dialog", () => {
    render(<InvoiceExportDialog projectId="p-1" open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "invoices.export.dialogDescription"
    );
  });
});
