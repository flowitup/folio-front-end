/**
 * DecimalInput: a French user's "2,5" and "18,90" must reach the form as 2.5
 * and 18.90, whatever language the browser speaks (QA round 3, billing-01).
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import {
  DecimalInput,
  formatDecimalForDisplay,
  formatDecimalForInput,
} from "@/components/ui/decimal-input";

function Harness({ initial = "", maxDecimals = 2 }: { initial?: string; maxDecimals?: number }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <DecimalInput aria-label="field" value={value} onValueChange={setValue} maxDecimals={maxDecimals} />
      <span data-testid="value">{value}</span>
    </>
  );
}

function renderIn(locale: string, ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {ui}
    </NextIntlClientProvider>
  );
}

const sent = () => screen.getByTestId("value").textContent;
const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("field"), { target: { value: text } });

describe("DecimalInput", () => {
  it("reads a comma as the decimal mark", () => {
    renderIn("fr", <Harness maxDecimals={3} />);
    type("2,5");
    expect(sent()).toBe("2.5");
    expect(screen.getByLabelText("field")).toHaveValue("2,5");
  });

  it("keeps the cents of a comma price", () => {
    renderIn("fr", <Harness maxDecimals={4} />);
    type("18,90");
    expect(sent()).toBe("18.9");
    expect(screen.getByLabelText("field")).toHaveValue("18,90");
  });

  it("also reads a point", () => {
    renderIn("en", <Harness maxDecimals={4} />);
    type("18.90");
    expect(sent()).toBe("18.9");
  });

  it("is a text field with a decimal keypad, not type=number", () => {
    renderIn("fr", <Harness />);
    const input = screen.getByLabelText("field");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("marks unreadable text invalid and passes it up as is", () => {
    renderIn("fr", <Harness />);
    type("2,5,1x");
    expect(screen.getByLabelText("field")).toHaveAttribute("aria-invalid", "true");
    expect(sent()).toBe("2,5,1x");
  });

  it("shows a stored value with the locale's mark", () => {
    renderIn("fr", <Harness initial="18.9000" />);
    expect(screen.getByLabelText("field")).toHaveValue("18,9");
  });

  it("formats for display and input", () => {
    expect(formatDecimalForInput("2.500", "vi")).toBe("2,5");
    expect(formatDecimalForInput("2.500", "en")).toBe("2.5");
    // Same text as the shared money-input formatter: no grouping, no padding, every decimal kept.
    expect(formatDecimalForInput("2.375", "fr")).toBe("2,375");
    expect(formatDecimalForInput("18.1234", "fr")).toBe("18,1234");
    expect(formatDecimalForInput("12500", "fr")).toBe("12500");
    expect(formatDecimalForDisplay("1234.5", "en", 3)).toBe("1,234.5");
  });
});
