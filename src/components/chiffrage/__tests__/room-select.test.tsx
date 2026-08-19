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
