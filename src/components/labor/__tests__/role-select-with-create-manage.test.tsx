/**
 * RoleSelectWithCreate — create, rename, recolor and delete from the role
 * picker.
 *
 * The create option and the edit control only show for a company admin or
 * manager (`canManage`); the pencil works from the keyboard without selecting
 * a role; a color-only change on a seeded role must not rename it to the
 * viewer's translated label; delete asks first, cancelling keeps what was
 * typed, clears the selection when the selected role goes, and a refusal is
 * shown in the backend's words; a role deleted elsewhere is dropped.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { RoleSelectWithCreate } from "../role-select-with-create";
import type { LaborRole } from "@/types/labor-role";

const actions = vi.hoisted(() => ({
  createLaborRoleAction: vi.fn(),
  updateLaborRoleAction: vi.fn(),
  deleteLaborRoleAction: vi.fn(),
}));
vi.mock("../labor-role-actions", () => actions);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const m = enMessages.labor.role;

const SEEDED: LaborRole = {
  id: "r-seed",
  name: "Thợ chính",
  color: "#E11D48",
  created_at: "2026-01-01T00:00:00Z",
  slug: "tho_chinh",
};
const CUSTOM: LaborRole = {
  id: "r-custom",
  name: "Electrician",
  color: "#0EA5E9",
  created_at: "2026-01-02T00:00:00Z",
  slug: null,
};
const PALETTE = ["#E11D48", "#0EA5E9", "#10B981"];

function renderPicker(props: Partial<React.ComponentProps<typeof RoleSelectWithCreate>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onRoleCreated: vi.fn(),
    onRoleUpdated: vi.fn(),
    onRoleDeleted: vi.fn(),
  };
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <RoleSelectWithCreate
        roles={[SEEDED, CUSTOM]}
        palette={PALETTE}
        value={null}
        canManage
        {...handlers}
        {...props}
      />
    </NextIntlClientProvider>
  );
  fireEvent.click(screen.getByRole("combobox"));
  return handlers;
}

const editButton = (label: string) =>
  screen.getByRole("button", { name: m.editNamed.replace("{name}", label) });

const trashButton = (label: string) =>
  screen.getByRole("button", { name: m.deleteNamed.replace("{name}", label) });

/** The cmdk option currently highlighted (the one Enter on the list would pick). */
const highlighted = () => document.querySelector('[cmdk-item][data-selected="true"]');

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RoleSelectWithCreate — manage roles", () => {
  it("offers no edit control to someone who may not manage roles", () => {
    renderPicker({ canManage: false });

    expect(screen.getByText("Electrician")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: m.editNamed.replace("{name}", "Electrician") })
    ).toBeNull();
  });

  it("offers Create only to someone who may manage roles", () => {
    renderPicker({ canManage: false });
    fireEvent.change(screen.getByPlaceholderText(m.searchRoles), {
      target: { value: "Plumber" },
    });

    expect(screen.queryByText(m.createNamed.replace("{name}", "Plumber"))).toBeNull();
  });

  it("offers Create to a company admin or manager", () => {
    renderPicker();
    fireEvent.change(screen.getByPlaceholderText(m.searchRoles), {
      target: { value: "Plumber" },
    });

    expect(screen.getByText(m.createNamed.replace("{name}", "Plumber"))).toBeDefined();
  });

  it("opens the editor on Enter from the pencil, without selecting a role", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ value: "r-custom" });

    editButton("Electrician").focus();
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText(m.roleName) as HTMLInputElement).value).toBe("Electrician");
  });

  it("keeps arrow keys on the pencil from moving the list highlight", async () => {
    const user = userEvent.setup();
    renderPicker();
    const before = highlighted();
    expect(before?.textContent).toBe(m.noRole);

    editButton("Electrician").focus();
    await user.keyboard("{ArrowDown}");

    expect(highlighted()).toBe(before);
  });

  it("renames a role and hands the saved role back", async () => {
    const saved = { ...CUSTOM, name: "Electrician (lead)" };
    actions.updateLaborRoleAction.mockResolvedValue({ success: true, role: saved });
    const { onRoleUpdated } = renderPicker();

    fireEvent.click(editButton("Electrician"));
    const input = screen.getByLabelText(m.roleName) as HTMLInputElement;
    expect(input.value).toBe("Electrician");
    fireEvent.change(input, { target: { value: "Electrician (lead)" } });
    fireEvent.click(screen.getByRole("button", { name: m.save }));

    await waitFor(() => expect(onRoleUpdated).toHaveBeenCalledWith(saved));
    expect(actions.updateLaborRoleAction).toHaveBeenCalledWith("r-custom", {
      name: "Electrician (lead)",
    });
    expect(toast.success).toHaveBeenCalledWith(m.updated);
  });

  it("recolors a seeded role without renaming it to the translated label", async () => {
    actions.updateLaborRoleAction.mockResolvedValue({
      success: true,
      role: { ...SEEDED, color: "#10B981" },
    });
    renderPicker();

    fireEvent.click(editButton(m.defaults.masterCraftsman));
    // Pre-filled with what the viewer sees, not the stored Vietnamese name.
    expect((screen.getByLabelText(m.roleName) as HTMLInputElement).value).toBe(
      m.defaults.masterCraftsman
    );
    fireEvent.click(screen.getByRole("button", { name: "#10B981" }));
    fireEvent.click(screen.getByRole("button", { name: m.save }));

    await waitFor(() =>
      expect(actions.updateLaborRoleAction).toHaveBeenCalledWith("r-seed", { color: "#10B981" })
    );
  });

  it("shows why an edit was refused", async () => {
    actions.updateLaborRoleAction.mockResolvedValue({
      success: false,
      error: "forbidden",
      message: "Company admin or manager permission required",
    });
    const { onRoleUpdated } = renderPicker();

    fireEvent.click(editButton("Electrician"));
    fireEvent.change(screen.getByLabelText(m.roleName), { target: { value: "Plumber" } });
    fireEvent.click(screen.getByRole("button", { name: m.save }));

    expect((await screen.findByRole("alert")).textContent).toBe(m.errors.forbidden);
    expect(onRoleUpdated).not.toHaveBeenCalled();
  });

  it("asks before deleting, and cancelling deletes nothing", () => {
    renderPicker();

    fireEvent.click(editButton("Electrician"));
    fireEvent.click(
      screen.getByRole("button", { name: m.deleteNamed.replace("{name}", "Electrician") })
    );

    expect(screen.getByText(m.confirmDeleteTitle.replace("{name}", "Electrician"))).toBeDefined();
    expect(screen.getByText(m.confirmDelete)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: m.cancel }));
    expect(actions.deleteLaborRoleAction).not.toHaveBeenCalled();
  });

  it("returns to the edit form with what was typed when the delete is cancelled", () => {
    renderPicker();

    fireEvent.click(editButton("Electrician"));
    fireEvent.change(screen.getByLabelText(m.roleName), { target: { value: "Sparky" } });
    fireEvent.click(screen.getByRole("button", { name: "#10B981" }));
    fireEvent.click(trashButton("Electrician"));
    fireEvent.click(screen.getByRole("button", { name: m.cancel }));

    expect((screen.getByLabelText(m.roleName) as HTMLInputElement).value).toBe("Sparky");
    expect(screen.getByRole("button", { name: "#10B981" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(document.activeElement).toBe(trashButton("Electrician"));
    expect(actions.deleteLaborRoleAction).not.toHaveBeenCalled();
  });

  it("drops a role someone else already deleted when saving it", async () => {
    actions.updateLaborRoleAction.mockResolvedValue({
      success: false,
      error: "notFound",
      message: "Labor role r-custom not found",
    });
    const { onChange, onRoleDeleted, onRoleUpdated } = renderPicker({ value: "r-custom" });

    fireEvent.click(editButton("Electrician"));
    fireEvent.change(screen.getByLabelText(m.roleName), { target: { value: "Plumber" } });
    fireEvent.click(screen.getByRole("button", { name: m.save }));

    await waitFor(() => expect(onRoleDeleted).toHaveBeenCalledWith("r-custom"));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRoleUpdated).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(m.errors.notFound);
    expect(screen.queryByLabelText(m.roleName)).toBeNull();
  });

  it("deletes the selected role and clears the selection", async () => {
    actions.deleteLaborRoleAction.mockResolvedValue({ success: true });
    const { onChange, onRoleDeleted } = renderPicker({ value: "r-custom" });

    fireEvent.click(editButton("Electrician"));
    fireEvent.click(
      screen.getByRole("button", { name: m.deleteNamed.replace("{name}", "Electrician") })
    );
    fireEvent.click(screen.getByRole("button", { name: m.deleteRole }));

    await waitFor(() => expect(onRoleDeleted).toHaveBeenCalledWith("r-custom"));
    expect(actions.deleteLaborRoleAction).toHaveBeenCalledWith("r-custom");
    expect(onChange).toHaveBeenCalledWith(null);
    expect(toast.success).toHaveBeenCalledWith(m.deleted);
  });

  it("keeps the confirmation up with the backend's reason when a delete is refused", async () => {
    actions.deleteLaborRoleAction.mockResolvedValue({
      success: false,
      error: "generic",
      message: "Role is still assigned",
    });
    const { onRoleDeleted } = renderPicker();

    fireEvent.click(editButton("Electrician"));
    fireEvent.click(
      screen.getByRole("button", { name: m.deleteNamed.replace("{name}", "Electrician") })
    );
    fireEvent.click(screen.getByRole("button", { name: m.deleteRole }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      `${m.deleteFailed}: Role is still assigned`
    );
    expect(screen.getByText(m.confirmDelete)).toBeDefined();
    expect(onRoleDeleted).not.toHaveBeenCalled();
  });
});
