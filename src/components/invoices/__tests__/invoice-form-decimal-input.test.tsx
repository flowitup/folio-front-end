/**
 * Line figures are typed as text and read in any of the app's locales.
 *
 * The number inputs used to rewrite every half-typed value to 0 under the
 * cursor ("45," → 0, so "45,90" saved as 4 590 €), refused more than 2
 * decimals through the browser's step check, and showed a float-drifted
 * total (5,27 € in the form, 5,28 € once saved).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "../invoice-form";
import { formatEUR } from "@/lib/utils/formatters";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/invoices/payment-method-select", () => ({ PaymentMethodSelect: () => null }));

// formatEUR emits U+202F/U+00A0; testing-library's normalizer turns them into spaces.
const eur = (n: number) => formatEUR(n).replace(/[  ]/g, " ");

const desktop = () => screen.getByTestId("invoice-items-desktop");
/** Desktop line figures: qty(0), unit price(1), VAT(2). */
const figures = () =>
  Array.from(desktop().querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'));

function renderForm(items = [{ description: "Gasoil", quantity: 1, unit_price: 0, vat_rate: 0 }]) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const { container } = render(
    <InvoiceForm
      onSubmit={onSubmit}
      initialValues={{ type: "others", issue_date: "2026-09-01", recipient_name: "Total", items }}
    />
  );
  const submit = () => fireEvent.submit(container.querySelector("form")!);
  return { onSubmit, submit };
}

async function retype(input: HTMLInputElement, text: string) {
  const user = userEvent.setup();
  await user.clear(input);
  if (text) await user.type(input, text);
}

describe("InvoiceForm — decimal line figures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps a French decimal comma as typed and saves 45.9, not 4590", async () => {
    const { onSubmit, submit } = renderForm();
    const [, price] = figures();

    await retype(price, "45,90");

    expect(price).toHaveValue("45,90");
    expect(within(desktop()).getByText(eur(45.9))).toBeInTheDocument();
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].items[0].unit_price).toBe(45.9);
  });

  it("leaves a cleared field empty and asks for a number instead of saving 0", async () => {
    const { onSubmit, submit } = renderForm([
      { description: "Gasoil", quantity: 1, unit_price: 12, vat_rate: 0 },
    ]);
    const [, price] = figures();

    await retype(price, "");

    expect(price).toHaveValue("");
    submit();
    expect(screen.getByText("errorUnitPriceInvalid")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    [0, "1e3", "errorQuantityInvalid"],
    [0, "2,3755", "errorQuantityInvalid"],
    [1, "1,85912", "errorUnitPriceInvalid"],
    [1, "abc", "errorUnitPriceInvalid"],
    [2, "5,555", "errorVatRateInvalid"],
    [2, "120", "errorVatRateInvalid"],
  ])("refuses figure %i = %j with %s", async (index, text, message) => {
    const { onSubmit, submit } = renderForm();

    await retype(figures()[index], text);

    expect(figures()[index]).toHaveValue(text);
    submit();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts 3-decimal quantities, 4-decimal prices and a comma VAT (no browser step check)", async () => {
    const { onSubmit, submit } = renderForm();
    const [qty, price, vat] = figures();
    expect(price).not.toHaveAttribute("step");

    await retype(qty, "2,375");
    await retype(price, "1.859");
    await retype(vat, "5,5");

    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].items[0]).toEqual({
      description: "Gasoil",
      quantity: 2.375,
      unit_price: 1.859,
      vat_rate: 5.5,
    });
  });

  it("re-saves an expense entered elsewhere with 3-4 decimals unchanged", () => {
    const { onSubmit, submit } = renderForm([
      { description: "Gasoil", quantity: 2.375, unit_price: 1.859, vat_rate: 20 },
    ]);
    const [qty, price] = figures();
    expect(qty).toHaveValue("2.375");
    expect(price).toHaveValue("1.859");

    submit();
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({ quantity: 2.375, unit_price: 1.859 });
  });

  it("shows the total the API will store (5 € at 5,5 % is 5,28 €, not 5,27 €)", () => {
    renderForm([{ description: "Gasoil", quantity: 1, unit_price: 5, vat_rate: 5.5 }]);

    // Row total and grand total
    expect(within(desktop()).getByText(eur(5.28))).toBeInTheDocument();
    expect(screen.getByText(`totalAmount: ${eur(5.28)}`)).toBeInTheDocument();
  });
});

describe("InvoiceForm — issue date range", () => {
  it("bounds the date picker to the years the API accepts", () => {
    renderForm();
    const input = screen.getByLabelText(/issueDate/) as HTMLInputElement;
    expect(input).toHaveAttribute("min", "2000-01-01");
    expect(input).toHaveAttribute("max", "2100-12-31");
  });

  it.each(["0026-01-01", "1900-01-01", "9999-12-31"])("refuses %s before calling the API", (day) => {
    const { onSubmit, submit } = renderForm([
      { description: "Gasoil", quantity: 1, unit_price: 5, vat_rate: 0 },
    ]);

    fireEvent.change(screen.getByLabelText(/issueDate/), { target: { value: day } });
    submit();

    expect(screen.getByText("errorDateOutOfRange")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
