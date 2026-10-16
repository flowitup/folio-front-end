import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DisabledReason } from "../disabled-reason";

describe("DisabledReason", () => {
  it("shows why a greyed-out button is unavailable on tap or click", () => {
    render(
      <DisabledReason reason="Only an admin can remove this person.">
        <button disabled>Remove</button>
      </DisabledReason>
    );
    const wrapper = screen.getByTestId("disabled-reason");
    expect(wrapper).toHaveAttribute("title", "Only an admin can remove this person.");
    fireEvent.click(wrapper);
    expect(screen.getByRole("dialog")).toHaveTextContent("Only an admin can remove this person.");
  });

  it("renders the child untouched when there is no reason", () => {
    render(
      <DisabledReason reason={undefined}>
        <button>Remove</button>
      </DisabledReason>
    );
    expect(screen.queryByTestId("disabled-reason")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });
});
