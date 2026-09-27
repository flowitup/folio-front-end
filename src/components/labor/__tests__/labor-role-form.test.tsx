/**
 * LaborRoleForm — the name + color form behind every labor-role editor.
 *
 * A stored color may differ from the palette only by hex case (the API, the
 * mobile app or the plugin may save "#e11d48"): the editor must open with that
 * swatch selected, not with no swatch or a duplicate one.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { LaborRoleForm } from "../labor-role-form";

const m = enMessages.labor.role;
const PALETTE = ["#E11D48", "#0EA5E9"];

function renderForm(initialColor?: string) {
  const onSubmit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LaborRoleForm
        palette={PALETTE}
        initialName="Electrician"
        initialColor={initialColor}
        submitLabel={m.save}
        submitting={false}
        error={null}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    </NextIntlClientProvider>
  );
  return onSubmit;
}

const swatches = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-label")?.startsWith("#"));

describe("LaborRoleForm", () => {
  it("selects the palette swatch for a stored color in lowercase, without a duplicate", () => {
    const onSubmit = renderForm("#e11d48");

    expect(swatches().map((b) => b.getAttribute("aria-label"))).toEqual(PALETTE);
    expect(screen.getByRole("button", { name: "#E11D48" }).getAttribute("aria-pressed")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: m.save }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Electrician", color: "#E11D48" });
  });

  it("keeps a stored color that is not in the palette selectable", () => {
    renderForm("#123456");

    expect(swatches().map((b) => b.getAttribute("aria-label"))).toEqual([
      ...PALETTE,
      "#123456",
    ]);
    expect(screen.getByRole("button", { name: "#123456" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("starts on the first swatch when creating", () => {
    renderForm();

    expect(screen.getByRole("button", { name: PALETTE[0] }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});
