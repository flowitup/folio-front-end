import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecimalInput, canonicalDecimal } from "../decimal-input";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DecimalInput aria-label="qty" maxDecimals={3} value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue("7")}>
        fill
      </button>
    </>
  );
}

describe("DecimalInput", () => {
  it("keeps what was typed and hands up a canonical number", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "qty" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "18,5" } });
    expect(input.value).toBe("18,5");
    expect(screen.getByTestId("value").textContent).toBe("18.5");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("shows a value the parent sets", () => {
    render(<Harness initial="1" />);
    fireEvent.click(screen.getByText("fill"));
    expect((screen.getByRole("textbox", { name: "qty" }) as HTMLInputElement).value).toBe("7");
  });

  it("passes unreadable text through so the form can refuse it", () => {
    expect(canonicalDecimal("18,", 3)).toBe("18,");
    expect(canonicalDecimal("1 234,5", 3)).toBe("1234.5");
    expect(canonicalDecimal("45.90", 4)).toBe("45.9");
  });
});
