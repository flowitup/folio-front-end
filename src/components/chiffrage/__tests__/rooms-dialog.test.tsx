/**
 * rooms-dialog.test.tsx
 *
 * Rooms are one project-wide list whose order decides how every poste groups
 * its items. These pin that the arrows ask to move a room into its neighbour's
 * slot, that the ends of the list cannot move further, that nothing else can be
 * clicked while a change is being saved, that deleting asks first, and that a
 * rename or an add that fails keeps what the user typed.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RoomsDialog } from "../rooms-dialog";
import type { ChiffrageRoom } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

const ROOMS: ChiffrageRoom[] = [
  { id: "r1", name: "Salon", position: 1000 },
  { id: "r2", name: "Cuisine", position: 2000 },
  { id: "r3", name: "Chambre", position: 3000 },
];

const ok = () => vi.fn().mockResolvedValue(true);

function renderDialog(
  over: Partial<React.ComponentProps<typeof RoomsDialog>> = {},
) {
  const props = {
    open: true,
    rooms: ROOMS,
    onOpenChange: vi.fn(),
    onCreate: ok(),
    onRename: ok(),
    onDelete: ok(),
    onReorder: ok(),
    ...over,
  };
  render(<RoomsDialog {...props} />);
  return props;
}

const rows = () => screen.getAllByTestId("room-row");

describe("RoomsDialog", () => {
  let confirmSpy: MockInstance<(message?: string) => boolean>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("lists the rooms in the order the project holds them", () => {
    renderDialog();
    expect(rows().map((r) => r.textContent)).toEqual([
      "Salon",
      "Cuisine",
      "Chambre",
    ]);
  });

  it("says so when the project has no room yet", () => {
    renderDialog({ rooms: [] });
    expect(screen.getByTestId("rooms-empty")).toHaveTextContent("noRoomsYet");
    expect(screen.queryByTestId("room-row")).not.toBeInTheDocument();
  });

  it("moves a room up into the slot of the room above it", async () => {
    const { onReorder } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("moveUp"));
    expect(onReorder).toHaveBeenCalledWith("r2", "r1");
  });

  it("moves a room down into the slot of the room below it", async () => {
    const { onReorder } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("moveDown"));
    expect(onReorder).toHaveBeenCalledWith("r2", "r3");
  });

  it("cannot move the first room up nor the last one down", () => {
    renderDialog();
    expect(within(rows()[0]).getByLabelText("moveUp")).toBeDisabled();
    expect(within(rows()[0]).getByLabelText("moveDown")).toBeEnabled();
    expect(within(rows()[2]).getByLabelText("moveDown")).toBeDisabled();
    expect(within(rows()[2]).getByLabelText("moveUp")).toBeEnabled();
  });

  it("disables every control while a move is being saved", async () => {
    let finish: (value: boolean) => void = () => {};
    const onReorder = vi.fn(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    renderDialog({ onReorder });

    await userEvent.click(within(rows()[2]).getByLabelText("moveUp"));
    expect(within(rows()[1]).getByLabelText("moveUp")).toBeDisabled();
    expect(within(rows()[0]).getByLabelText("deleteRoom")).toBeDisabled();
    expect(screen.getByTestId("rooms-new")).toBeDisabled();

    finish(true);
    await waitFor(() =>
      expect(within(rows()[1]).getByLabelText("moveUp")).toBeEnabled(),
    );
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it("renames a room from its row", async () => {
    const { onRename } = renderDialog();
    await userEvent.click(within(rows()[0]).getByLabelText("renameRoom"));
    const input = screen.getByLabelText("roomName");
    expect(input).toHaveValue("Salon");

    await userEvent.clear(input);
    await userEvent.type(input, "Séjour{Enter}");

    expect(onRename).toHaveBeenCalledWith(ROOMS[0], "Séjour");
    await waitFor(() =>
      expect(screen.queryByLabelText("roomName")).not.toBeInTheDocument(),
    );
  });

  it("keeps the new name on screen when the rename fails", async () => {
    const onRename = vi.fn().mockResolvedValue(false);
    renderDialog({ onRename });
    await userEvent.click(within(rows()[0]).getByLabelText("renameRoom"));
    const input = screen.getByLabelText("roomName");
    await userEvent.clear(input);
    await userEvent.type(input, "Cuisine{Enter}");

    expect(onRename).toHaveBeenCalled();
    // Once the failed save settles the field is editable again, still filled.
    await waitFor(() =>
      expect(screen.getByLabelText("roomName")).toBeEnabled(),
    );
    expect(screen.getByLabelText("roomName")).toHaveValue("Cuisine");
  });

  it("does not send a rename that changes nothing", async () => {
    const { onRename } = renderDialog();
    await userEvent.click(within(rows()[0]).getByLabelText("renameRoom"));
    await userEvent.click(screen.getByLabelText("save"));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("roomName")).not.toBeInTheDocument();
  });

  it("abandons a rename on cancel", async () => {
    const { onRename } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("renameRoom"));
    await userEvent.type(screen.getByLabelText("roomName"), " ouverte");
    await userEvent.click(screen.getByLabelText("cancel"));

    expect(onRename).not.toHaveBeenCalled();
    expect(rows()[1]).toHaveTextContent("Cuisine");
  });

  it("abandons a rename on Escape without closing the dialog", async () => {
    const { onRename, onOpenChange } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("renameRoom"));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("roomName")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("asks before deleting a room, naming it", async () => {
    const { onDelete } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("deleteRoom"));

    expect(confirmSpy).toHaveBeenCalledWith("confirmDeleteRoom:Cuisine");
    expect(onDelete).toHaveBeenCalledWith(ROOMS[1]);
  });

  it("deletes nothing when the confirmation is declined", async () => {
    confirmSpy.mockReturnValue(false);
    const { onDelete } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("deleteRoom"));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("adds a room and clears the field", async () => {
    const { onCreate } = renderDialog();
    const input = screen.getByTestId("rooms-new");
    await userEvent.type(input, "  Garage ");
    await userEvent.click(screen.getByRole("button", { name: "add" }));

    expect(onCreate).toHaveBeenCalledWith("Garage");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("keeps the typed name when the room could not be added", async () => {
    const onCreate = vi.fn().mockResolvedValue(false);
    renderDialog({ onCreate });
    const input = screen.getByTestId("rooms-new");
    await userEvent.type(input, "Salon{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Salon");
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue("Salon");
  });

  it("cannot add a blank room", async () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "add" })).toBeDisabled();
    await userEvent.type(screen.getByTestId("rooms-new"), "   ");
    expect(screen.getByRole("button", { name: "add" })).toBeDisabled();
  });

  it("gives each drag handle an accessible name", () => {
    renderDialog();
    expect(screen.getAllByLabelText("dragToReorder")).toHaveLength(3);
  });
});
