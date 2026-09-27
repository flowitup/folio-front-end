/**
 * Combobox free-text behaviour: typed text must win over cmdk's auto-highlighted
 * first option, survive closing the popover, and be clearable.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "Finitions", label: "Finitions" },
  { value: "Gros oeuvre", label: "Gros oeuvre" },
];

function Harness({
  initial = "",
  onChange,
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <Combobox
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        options={OPTIONS}
        placeholder="Section"
      />
      <span data-testid="value">{value}</span>
      <button type="button">outside</button>
    </>
  );
}

async function openAndType(text: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("combobox"));
  });
  const input = screen.getByPlaceholderText("Section");
  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
  });
  return input;
}

const committed = () => screen.getByTestId("value").textContent;

describe("Combobox — free text", () => {
  it("commits the typed text on Enter instead of the first option", async () => {
    render(<Harness />);
    const input = await openAndType("New section");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(committed()).toBe("New section");
  });

  it("picks the highlighted option when the user moved to it with the arrows", async () => {
    render(<Harness />);
    const input = await openAndType("");
    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(committed()).toBe("Gros oeuvre");
  });

  it("reuses an existing option typed with different case", async () => {
    render(<Harness />);
    const input = await openAndType("finitions");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(committed()).toBe("Finitions");
  });

  it("keeps the typed text when the popover is closed by a click outside", async () => {
    render(<Harness />);
    await openAndType("Outside section");
    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    });
    expect(committed()).toBe("Outside section");
  });

  it("clears the value when the text is erased", async () => {
    const onChange = vi.fn();
    render(<Harness initial="Finitions" onChange={onChange} />);
    const input = await openAndType("");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(committed()).toBe("");
  });

  it("reverts the typed text on Escape", async () => {
    render(<Harness initial="Finitions" />);
    const input = await openAndType("Discarded");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(committed()).toBe("Finitions");
  });

  it("filters the options by the typed text when the caller does not", async () => {
    render(<Harness />);
    await openAndType("gros");
    expect(screen.queryByRole("option", { name: "Finitions" })).toBeNull();
    expect(screen.getByRole("option", { name: "Gros oeuvre" })).toBeDefined();
  });
});
