/**
 * member-picker-dropdown.test.tsx
 *
 * Isolated coverage for the shared multi-select cell used by
 * CompanyMembersTable's Company and Projects columns: trigger summary text,
 * disabled state, and that toggling a checklist item calls onToggle with the
 * right option and direction.
 *
 * Radix DropdownMenu needs real pointer events (userEvent, not fireEvent) to
 * open — same interaction strategy as billing-status-menu.test.tsx.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberPickerDropdown, type MemberPickerOption } from "../member-picker-dropdown";

const OPTIONS: MemberPickerOption[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

/** Open the Radix DropdownMenu and return the checkbox item elements. */
async function openMenu(user: ReturnType<typeof userEvent.setup>, name: RegExp | string) {
  const trigger = screen.getByRole("button", { name });
  await user.click(trigger);
  await waitFor(() => {
    if (document.querySelectorAll("[role='menuitemcheckbox']").length === 0) {
      throw new Error("checklist items not rendered yet");
    }
  });
  return Array.from(document.querySelectorAll("[role='menuitemcheckbox']"));
}

describe("MemberPickerDropdown", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={[]}
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pick one" })).toBeDefined();
  });

  it("summarises the selected option labels on the trigger", () => {
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={["a", "b"]}
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Alpha, Beta" })).toBeDefined();
  });

  it("disables the trigger when disabled is set (pending row)", () => {
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={[]}
        disabled
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pick one" })).toBeDisabled();
  });

  it("shows emptyText when there are no options to pick from", async () => {
    const user = userEvent.setup();
    render(
      <MemberPickerDropdown
        options={[]}
        selectedIds={[]}
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Pick one" }));
    expect(await screen.findByText("Nothing here")).toBeDefined();
  });

  it("checks the boxes that match selectedIds and calls onToggle(option, true) for an unchecked pick", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={["a"]}
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={onToggle}
      />
    );

    const items = await openMenu(user, "Alpha");
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute("data-state")).toBe("checked"); // Alpha
    expect(items[1].getAttribute("data-state")).toBe("unchecked"); // Beta

    await user.click(items[1]); // toggle Beta on
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(OPTIONS[1], true);
    });
  });

  it("calls onToggle(option, false) for an already-checked pick", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={["a"]}
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={onToggle}
      />
    );

    const items = await openMenu(user, "Alpha");
    await user.click(items[0]); // toggle Alpha off
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(OPTIONS[0], false);
    });
  });

  it("disables checklist items (not the trigger) while isMutating", async () => {
    const user = userEvent.setup();
    render(
      <MemberPickerDropdown
        options={OPTIONS}
        selectedIds={["a"]}
        isMutating
        placeholder="Pick one"
        emptyText="Nothing here"
        onToggle={vi.fn()}
      />
    );

    // The trigger stays enabled and shows the current selection while a
    // mutation for this row is in flight.
    expect(screen.getByRole("button", { name: "Alpha" })).not.toBeDisabled();

    const items = await openMenu(user, "Alpha");
    for (const item of items) {
      expect(item.getAttribute("data-disabled")).not.toBeNull();
    }
  });
});
