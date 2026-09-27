/**
 * Editing an expense whose payment method was deactivated since: the form does
 * not re-send the unchanged method (the API refuses an inactive one), still
 * sends an explicit change or clear, and translates the API's 409.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { InvoiceForm, classifySubmitError } from "../invoice-form";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const select = vi.hoisted(() => ({ onChange: null as null | ((id: string | null) => void) }));
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: (props: { onChange: (id: string | null) => void }) => {
    select.onChange = props.onChange;
    return null;
  },
}));

const METHOD = "11111111-1111-4111-8111-111111111111";
const INITIAL = {
  type: "others" as const,
  issue_date: "2026-09-01",
  recipient_name: "Leroy",
  items: [{ description: "Tape", quantity: 1, unit_price: 10, vat_rate: 0 }],
  payment_method_id: METHOD,
};

function renderEdit(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <InvoiceForm
      onSubmit={onSubmit}
      companyId="22222222-2222-4222-8222-222222222222"
      editingInvoiceId="33333333-3333-4333-8333-333333333333"
      initialValues={INITIAL}
    />,
  );
  return onSubmit;
}

describe("InvoiceForm — unchanged payment method on edit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves an unchanged method out of the update", async () => {
    const onSubmit = renderEdit();
    fireEvent.submit(screen.getByRole("button", { name: "save" }).closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("payment_method_id");
  });

  it("still sends a cleared method", async () => {
    const onSubmit = renderEdit();
    act(() => select.onChange!(null));
    fireEvent.submit(screen.getByRole("button", { name: "save" }).closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toHaveProperty("payment_method_id", null);
  });
});

describe("classifySubmitError — inactive payment method", () => {
  it("returns the translated message instead of the API text", () => {
    const err = { body: { error: "Conflict", message: "Payment method is inactive and cannot be used" } };
    expect(
      classifySubmitError(err, () => "", undefined, undefined, undefined, undefined, "translated"),
    ).toBe("translated");
  });
});
