/**
 * compare-bar.test.tsx — CompareBar tests.
 *
 * Tests:
 *   - Renders the selection count
 *   - Compare button disabled when canCompare is false, enabled when true
 *   - onClear / onCompare callbacks fire
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareBar } from "../compare-bar";

vi.mock("next-intl", () => ({
  useTranslations:
    (ns: string) =>
    (key: string, opts?: Record<string, unknown>) => {
      if (key === "compareSelected") return `${opts?.count} selected`;
      if (key === "compareAction") return `Compare (${opts?.count})`;
      const map: Record<string, string> = {
        compare: "Compare",
        clearSelection: "Clear",
      };
      return map[key] ?? `${ns}.${key}`;
    },
}));

describe("CompareBar", () => {
  it("renders the selection count", () => {
    render(
      <CompareBar count={3} canCompare onClear={vi.fn()} onCompare={vi.fn()} />
    );
    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("disables the compare action when canCompare is false", () => {
    render(
      <CompareBar count={1} canCompare={false} onClear={vi.fn()} onCompare={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Compare (1)" })).toBeDisabled();
  });

  it("enables the compare action when canCompare is true", () => {
    render(
      <CompareBar count={2} canCompare onClear={vi.fn()} onCompare={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Compare (2)" })).toBeEnabled();
  });

  it("fires onClear and onCompare", async () => {
    const onClear = vi.fn();
    const onCompare = vi.fn();
    render(
      <CompareBar count={2} canCompare onClear={onClear} onCompare={onCompare} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Compare (2)" }));
    expect(onCompare).toHaveBeenCalledOnce();
  });
});
