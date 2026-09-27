/** Expense lines are capped like billing lines by the API; the form says so first. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/invoices/payment-method-select", () => ({ PaymentMethodSelect: () => null }));

function submitWith(item: { quantity: number; unit_price: number }) {
  const onSubmit = vi.fn();
  render(
    <InvoiceForm
      onSubmit={onSubmit}
      initialValues={{
        type: "others",
        issue_date: "2026-09-01",
        recipient_name: "Leroy",
        items: [{ description: "Tape", vat_rate: 0, ...item }],
      }}
    />,
  );
  fireEvent.submit(screen.getByRole("button", { name: "save" }).closest("form")!);
  return onSubmit;
}

describe("InvoiceForm line caps", () => {
  it("refuses a quantity above the cap", () => {
    const onSubmit = submitWith({ quantity: 10_000_000, unit_price: 1 });
    expect(screen.getByText("errorQuantityTooLarge")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a unit price above the cap, either sign", () => {
    const onSubmit = submitWith({ quantity: 1, unit_price: -1_000_000_000 });
    expect(screen.getByText("errorUnitPriceTooLarge")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
