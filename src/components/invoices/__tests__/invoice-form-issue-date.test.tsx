/**
 * The issue date of a new expense defaults to today in Paris, and an emptied
 * date is caught by the form with a translated message instead of the API's
 * raw "Invalid input: issue_date".
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "en",
}));

afterEach(() => vi.useRealTimers());

function issueDateInput() {
  return screen.getByLabelText(/invoices\.issueDate/) as HTMLInputElement;
}

describe("InvoiceForm — issue date", () => {
  it("defaults a new expense to today in Paris, even just after midnight", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T22:30:00Z")); // 00:30 on the 27th in Paris

    render(<InvoiceForm onSubmit={vi.fn()} />);

    expect(issueDateInput().value).toBe("2026-09-27");
    expect(issueDateInput()).toHaveAttribute("aria-required", "true");
  });

  it("keeps an edited expense's own date", () => {
    render(
      <InvoiceForm
        onSubmit={vi.fn()}
        editingInvoiceId="inv-1"
        initialValues={{ issue_date: "2026-01-15" }}
      />
    );

    expect(issueDateInput().value).toBe("2026-01-15");
  });

  it("refuses to save without an issue date", () => {
    const onSubmit = vi.fn();
    const { container } = render(<InvoiceForm onSubmit={onSubmit} />);

    fireEvent.change(issueDateInput(), { target: { value: "" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByText("invoices.errorIssueDateRequired")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
