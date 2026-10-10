/**
 * room-select.test.tsx
 *
 * The room is picked before the item, from the project's shared list. These
 * pin that an unassigned choice stays possible, that adding a room inline
 * selects it straight away, and that a failed creation changes nothing.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoomSelect } from "../room-select";
import type { ChiffrageRoom } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const ROOMS: ChiffrageRoom[] = [
  { id: "r1", name: "Salon", position: 1000 },
  { id: "r2", name: "Cuisine", position: 2000 },
];

describe("RoomSelect", () => {
  it("lists the project's rooms", async () => {
    render(<RoomSelect value={null} rooms={ROOMS} onChange={() => {}} onCreateRoom={async () => null} />);
    await userEvent.click(screen.getByTestId("room-select-trigger"));
    expect(screen.getByRole("button", { name: "Salon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuisine" })).toBeInTheDocument();
  });

  it("shows the selected room on the trigger", () => {
    render(<RoomSelect value="r2" rooms={ROOMS} onChange={() => {}} onCreateRoom={async () => null} />);
    expect(screen.getByTestId("room-select-trigger")).toHaveTextContent("Cuisine");
  });

  it("allows leaving the item unassigned", async () => {
    const onChange = vi.fn();
    render(<RoomSelect value="r1" rooms={ROOMS} onChange={onChange} onCreateRoom={async () => null} />);
    await userEvent.click(screen.getByTestId("room-select-trigger"));
    await userEvent.click(screen.getAllByText("noRoom")[0]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("selects a room that was just added, without a second click", async () => {
    const created: ChiffrageRoom = { id: "r9", name: "Garage", position: 3000 };
    const onCreateRoom = vi.fn().mockResolvedValue(created);
    const onChange = vi.fn();
    render(<RoomSelect value={null} rooms={ROOMS} onChange={onChange} onCreateRoom={onCreateRoom} />);

    await userEvent.click(screen.getByTestId("room-select-trigger"));
    await userEvent.type(screen.getByTestId("room-select-new"), "Garage");
    await userEvent.click(screen.getByLabelText("addRoom"));

    expect(onCreateRoom).toHaveBeenCalledWith("Garage");
    expect(onChange).toHaveBeenCalledWith("r9");
  });

  it("changes nothing when the room could not be created", async () => {
    const onChange = vi.fn();
    render(
      <RoomSelect value={null} rooms={ROOMS} onChange={onChange} onCreateRoom={async () => null} />,
    );
    await userEvent.click(screen.getByTestId("room-select-trigger"));
    await userEvent.type(screen.getByTestId("room-select-new"), "Garage");
    await userEvent.click(screen.getByLabelText("addRoom"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not offer to add a blank room name", async () => {
    render(<RoomSelect value={null} rooms={ROOMS} onChange={() => {}} onCreateRoom={async () => null} />);
    await userEvent.click(screen.getByTestId("room-select-trigger"));
    expect(screen.getByLabelText("addRoom")).toBeDisabled();
  });
});

describe("RoomSelect as a labelled field", () => {
  function renderLabelled(value: string | null = "r2") {
    render(
      <>
        <label id="room-label" htmlFor="room">
          Room
        </label>
        <RoomSelect
          id="room"
          labelledBy="room-label"
          value={value}
          rooms={ROOMS}
          onChange={() => {}}
          onCreateRoom={async () => null}
        />
      </>,
    );
  }

  it("is named by its label plus the room it shows", () => {
    renderLabelled();
    const trigger = screen.getByTestId("room-select-trigger");
    expect(screen.getByLabelText("Room")).toBe(trigger);
    expect(screen.getByRole("button", { name: "Room Cuisine" })).toBe(trigger);
  });

  it("opens from a click on its label", async () => {
    renderLabelled(null);
    await userEvent.click(screen.getByText("Room"));
    expect(screen.getByRole("button", { name: "Salon" })).toBeInTheDocument();
  });

  it("sizes the dropdown to the field (a v4-valid var() width)", async () => {
    renderLabelled();
    await userEvent.click(screen.getByTestId("room-select-trigger"));
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("w-[var(--radix-popover-trigger-width)]");
    expect(content.className).not.toContain("w-[--radix-popover-trigger-width]");
  });
});
