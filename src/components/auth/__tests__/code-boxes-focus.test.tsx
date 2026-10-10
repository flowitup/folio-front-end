/**
 * The code boxes are disabled while a code is checked, which drops the caret
 * to <body>. After a rejection the first box gets it back, so the user can
 * retype straight away instead of clicking a box first.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeBoxes } from "../CodeBoxes";

function boxes(props: { disabled: boolean; state: "idle" | "error" | "verified" }) {
  return (
    <CodeBoxes
      value="111111"
      onChange={vi.fn()}
      label="SMS code"
      positionLabel={(position) => `Digit ${position}`}
      {...props}
    />
  );
}

describe("CodeBoxes focus after a rejected code", () => {
  it("returns the caret to the first box once the row is enabled again with an error", () => {
    const { rerender } = render(boxes({ disabled: false, state: "idle" }));
    // A browser drops the caret to <body> when the focused box is disabled.
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(boxes({ disabled: true, state: "idle" }));
    expect(document.activeElement).toBe(document.body);

    // The verify call settles: first the boxes are enabled, then the error shows.
    rerender(boxes({ disabled: false, state: "idle" }));
    rerender(boxes({ disabled: false, state: "error" }));

    expect(document.activeElement).toBe(screen.getByTestId("login-code-0"));
  });

  it("does not take the caret from another field", () => {
    const { rerender } = render(
      <>
        {boxes({ disabled: false, state: "idle" })}
        <input aria-label="other" />
      </>
    );
    rerender(
      <>
        {boxes({ disabled: true, state: "idle" })}
        <input aria-label="other" />
      </>
    );
    screen.getByLabelText("other").focus();
    rerender(
      <>
        {boxes({ disabled: false, state: "error" })}
        <input aria-label="other" />
      </>
    );

    expect(document.activeElement).toBe(screen.getByLabelText("other"));
  });

  it("leaves focus alone when the row was never submitted", () => {
    const { rerender } = render(boxes({ disabled: false, state: "idle" }));
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(boxes({ disabled: false, state: "error" }));

    expect(document.activeElement).toBe(document.body);
  });
});
