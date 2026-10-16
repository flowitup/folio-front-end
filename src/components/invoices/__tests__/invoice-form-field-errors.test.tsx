/**
 * A refused expense form says what is wrong under each field and brings the
 * first one into view: the only message used to be a line at the top of a
 * long form, out of sight from the Save button. API refusals are never shown
 * in the API's English.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceForm, classifySubmitError, invoiceValidationMessages } from "../invoice-form";
import { ApiError } from "@/lib/api/http";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: ({ disabled }: { disabled?: boolean }) => (
    <select data-testid="method-select" disabled={disabled} />
  ),
}));

function renderForm(initialValues = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const { container } = render(
    <InvoiceForm
      onSubmit={onSubmit}
      companyId="c-1"
      initialValues={{
        type: "others",
        issue_date: "2026-09-01",
        recipient_name: "",
        items: [{ description: "", quantity: 1, unit_price: -5, vat_rate: 150 }],
        ...initialValues,
      }}
    />
  );
  return { onSubmit, submit: () => fireEvent.submit(container.querySelector("form")!) };
}

describe("InvoiceForm — field errors", () => {
  it("puts each error under its field, marks it invalid and focuses the first one", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { onSubmit, submit } = renderForm();

    submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("errorFixFields");
    expect(screen.getByText("errorRecipientRequired")).toBeInTheDocument();
    expect(screen.getByText("errorDescriptionRequired")).toBeInTheDocument();
    expect(screen.getByText("errorUnitPriceNegative")).toBeInTheDocument();
    expect(screen.getByText("errorVatRateInvalid")).toBeInTheDocument();
    const recipient = document.getElementById("invoice-recipient")!;
    expect(recipient).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(recipient);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("drops a field's error once it is edited", () => {
    const { submit } = renderForm();
    submit();

    fireEvent.change(document.getElementById("invoice-recipient")!, { target: { value: "Total" } });

    expect(screen.queryByText("errorRecipientRequired")).toBeNull();
    expect(screen.getByText("errorDescriptionRequired")).toBeInTheDocument();
  });

  it("caps the texts at the lengths the API stores", () => {
    renderForm();
    expect(document.getElementById("invoice-recipient")).toHaveAttribute("maxLength", "255");
    expect(document.getElementById("invoice-recipient-address")).toHaveAttribute("maxLength", "2000");
    expect(document.getElementById("invoice-notes")).toHaveAttribute("maxLength", "20000");
  });

  it("locks the payment method of an avoir applied to an expense and does not send it", () => {
    const { onSubmit, submit } = renderForm({
      type: "return",
      recipient_name: "Point P",
      settled_via: "avoir",
      applied_to_invoice_id: "inv-1",
      payment_method_id: "pm-1",
      items: [{ description: "Avoir", quantity: 1, unit_price: -5, vat_rate: 0 }],
    });

    expect(screen.getByTestId("method-select")).toBeDisabled();
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("payment_method_id");
  });
});

describe("classifySubmitError — no raw English", () => {
  const messages = { forbidden: "forbidden", fallback: "fallback" };
  const t = (key: string) => key;

  it("translates a missing permission", () => {
    const err = new ApiError("HTTP 403", 403, {
      error: "Forbidden",
      message: "Missing permission: project:manage_invoices",
    });
    expect(classifySubmitError(err, () => "", undefined, undefined, undefined, undefined, undefined, [], messages)).toBe(
      "forbidden"
    );
  });

  it("translates the API's line limits and the delete guard", () => {
    const patterns = invoiceValidationMessages(t);
    const cases: Array<[string, string]> = [
      ["recipient_name: String should have at most 255 characters", "errorTextTooLong"],
      ["items.0.vat_rate: Value error, VAT rate allows at most 2 decimals", "errorVatRateInvalid"],
      ["items.0: Value error, Line amount exceeds the maximum of 9999999999.99", "errorLineTotalTooLarge"],
      ["Unlink the avoirs applied to this invoice before deleting it", "errorUnlinkAvoirsBeforeDelete"],
    ];
    for (const [message, key] of cases) {
      const err = new ApiError("HTTP 400", 400, { error: "ValidationError", message });
      expect(classifySubmitError(err, () => "", undefined, undefined, undefined, undefined, undefined, patterns, messages)).toBe(key);
    }
  });

  it("shows the translated fallback for any other refusal", () => {
    const err = new ApiError("HTTP 400", 400, { error: "ValidationError", message: "Something new" });
    expect(classifySubmitError(err, () => "", undefined, undefined, undefined, undefined, undefined, [], messages)).toBe(
      "fallback"
    );
  });
});
