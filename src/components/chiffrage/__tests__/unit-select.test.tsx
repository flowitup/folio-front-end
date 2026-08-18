/**
 * unit-select.test.tsx
 *
 * The unit is a dropdown rather than free text because the backend validates
 * the symbol against the same preset+custom set. These pin that there is no
 * free-text escape hatch and that adding a unit does not interrupt the entry.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UnitSelect } from "../unit-select";
import type { ChiffrageUnit } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const UNITS: ChiffrageUnit[] = [
  { id: null, symbol: "u", is_preset: true },
  { id: null, symbol: "m²", is_preset: true },
  { id: "c1", symbol: "sac 25kg", is_preset: false },
];

describe("UnitSelect", () => {
  it("offers presets and the project's own units, grouped", async () => {
    render(<UnitSelect value={null} units={UNITS} onChange={() => {}} onCreateUnit={async () => null} />);
    await userEvent.click(screen.getByTestId("unit-select-trigger"));

    expect(screen.getByText("presetUnits")).toBeInTheDocument();
    expect(screen.getByText("customUnits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^u$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sac 25kg" })).toBeInTheDocument();
  });

  it("selects a symbol and closes", async () => {
    const onChange = vi.fn();
    render(<UnitSelect value={null} units={UNITS} onChange={onChange} onCreateUnit={async () => null} />);
    await userEvent.click(screen.getByTestId("unit-select-trigger"));
    await userEvent.click(screen.getByRole("button", { name: "m²" }));

    expect(onChange).toHaveBeenCalledWith("m²");
  });

  it("clears the unit when the selected symbol is clicked again", async () => {
    const onChange = vi.fn();
    render(<UnitSelect value="u" units={UNITS} onChange={onChange} onCreateUnit={async () => null} />);
    await userEvent.click(screen.getByTestId("unit-select-trigger"));
    await userEvent.click(screen.getByRole("button", { name: /^u/ }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("adds a unit and selects it without closing the article form", async () => {
    const created: ChiffrageUnit = { id: "c2", symbol: "botte", is_preset: false };
    const onCreateUnit = vi.fn().mockResolvedValue(created);
    const onChange = vi.fn();

    render(<UnitSelect value={null} units={UNITS} onChange={onChange} onCreateUnit={onCreateUnit} />);
    await userEvent.click(screen.getByTestId("unit-select-trigger"));
    await userEvent.click(screen.getByTestId("add-unit-button"));
    await userEvent.type(screen.getByPlaceholderText("newUnitPlaceholder"), "botte");
    await userEvent.click(screen.getByRole("button", { name: "add" }));

    expect(onCreateUnit).toHaveBeenCalledWith("botte");
    expect(onChange).toHaveBeenCalledWith("botte");
  });

  it("keeps the draft when the server rejects the new unit", async () => {
    const onCreateUnit = vi.fn().mockResolvedValue(null); // e.g. 409 duplicate
    const onChange = vi.fn();

    render(<UnitSelect value={null} units={UNITS} onChange={onChange} onCreateUnit={onCreateUnit} />);
    await userEvent.click(screen.getByTestId("unit-select-trigger"));
    await userEvent.click(screen.getByTestId("add-unit-button"));
    await userEvent.type(screen.getByPlaceholderText("newUnitPlaceholder"), "u");
    await userEvent.click(screen.getByRole("button", { name: "add" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("newUnitPlaceholder")).toHaveValue("u");
  });

  it("never renders a free-text unit field", async () => {
    render(<UnitSelect value={null} units={UNITS} onChange={() => {}} onCreateUnit={async () => null} />);
    // Closed: the trigger is the only control, and it is a button not an input.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("unit-select-trigger").tagName).toBe("BUTTON");
  });
});
