/**
 * Editing an expense: emptying the notes or the recipient address sends "" so
 * the API clears them. A missing key means "keep" there, so the old text used
 * to come back after a save that reported success.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/invoices/payment-method-select", () => ({ PaymentMethodSelect: () => null }));

const INITIAL = {
  type: "others" as const,
  issue_date: "2026-09-01",
  recipient_name: "Leroy",
  recipient_address: "1 rue X",
  notes: "Note à effacer",
  items: [{ description: "Tape", quantity: 1, unit_price: 10, vat_rate: 0 }],
};

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: /save|create/ }).closest("form")!);
}

describe("InvoiceForm — clearing notes and recipient address", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends emptied fields as empty strings on edit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InvoiceForm onSubmit={onSubmit} companyId={null} editingInvoiceId="inv-1" initialValues={INITIAL} />);
    fireEvent.change(screen.getByDisplayValue("Note à effacer"), { target: { value: "  " } });
    fireEvent.change(screen.getByDisplayValue("1 rue X"), { target: { value: "" } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ notes: "", recipient_address: "" });
  });

  it("leaves empty fields out of a new expense", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <InvoiceForm
        onSubmit={onSubmit}
        companyId={null}
        initialValues={{ ...INITIAL, recipient_address: undefined, notes: undefined }}
      />,
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("notes");
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("recipient_address");
  });
});
