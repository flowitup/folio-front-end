/**
 * Settings › Company → Labor roles card.
 *
 * Everything is scoped to the company handed in (list and create carry its
 * id); rename and delete work in place; delete asks first and keeps its
 * dialog up with the reason when the backend refuses; a failed load says so
 * and can be retried instead of reading as "no roles".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { CompanyLaborRolesCard } from "../company-labor-roles-card";
import type { LaborRole } from "@/types/labor-role";

const actions = vi.hoisted(() => ({
  fetchLaborRolesAction: vi.fn(),
  createLaborRoleAction: vi.fn(),
  updateLaborRoleAction: vi.fn(),
  deleteLaborRoleAction: vi.fn(),
}));
vi.mock("@/app/[locale]/(app)/projects/[id]/labor/actions", () => actions);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const m = enMessages.labor.role;
const COMPANY = "11111111-1111-1111-1111-111111111111";
const PALETTE = ["#E11D48", "#0EA5E9"];

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

function listed(roles: LaborRole[]) {
  return { success: true, data: { roles, palette: PALETTE } };
}

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CompanyLaborRolesCard companyId={COMPANY} />
    </NextIntlClientProvider>
  );
}

const named = (template: string, name: string) => template.replace("{name}", name);

beforeEach(() => {
  vi.clearAllMocks();
  actions.fetchLaborRolesAction.mockResolvedValue(listed([SEEDED, CUSTOM]));
});

describe("CompanyLaborRolesCard", () => {
  it("lists the handed company's roles, seeded ones in the viewer's language", async () => {
    renderCard();

    expect(await screen.findByText("Electrician")).toBeDefined();
    expect(screen.getByText(m.defaults.masterCraftsman)).toBeDefined();
    expect(screen.getByText(m.manageTitle)).toBeDefined();
    expect(actions.fetchLaborRolesAction).toHaveBeenCalledWith(COMPANY);
  });

  it("says so when the company has no role yet", async () => {
    actions.fetchLaborRolesAction.mockResolvedValue(listed([]));
    renderCard();

    expect(await screen.findByText(m.noRolesYet)).toBeDefined();
  });

  it("reports a failed load and retries it", async () => {
    actions.fetchLaborRolesAction.mockResolvedValueOnce({ success: false, error: "generic" });
    renderCard();

    expect(await screen.findByText(m.loadFailed)).toBeDefined();
    expect(screen.queryByText(m.noRolesYet)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: m.retry }));
    expect(await screen.findByText("Electrician")).toBeDefined();
  });

  it("creates a role in the handed company", async () => {
    const created = { ...CUSTOM, id: "r-new", name: "Plumber" };
    actions.createLaborRoleAction.mockResolvedValue({ success: true, role: created });
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: m.createRole }));
    fireEvent.change(screen.getByLabelText(m.roleName), { target: { value: " Plumber " } });
    fireEvent.click(screen.getByRole("button", { name: m.create }));

    expect(await screen.findByText("Plumber")).toBeDefined();
    expect(actions.createLaborRoleAction).toHaveBeenCalledWith(
      { name: "Plumber", color: PALETTE[0] },
      COMPANY
    );
    expect(toast.success).toHaveBeenCalledWith(m.created);
  });

  it("shows a duplicate name next to the form and keeps it open", async () => {
    actions.createLaborRoleAction.mockResolvedValue({
      success: false,
      error: "duplicate",
      message: "A labor role named 'Electrician' already exists",
    });
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: m.createRole }));
    fireEvent.change(screen.getByLabelText(m.roleName), { target: { value: "Electrician" } });
    fireEvent.click(screen.getByRole("button", { name: m.create }));

    expect((await screen.findByRole("alert")).textContent).toBe(m.duplicateName);
    expect(screen.getByLabelText(m.roleName)).toBeDefined();
  });

  it("refuses to submit an empty name", async () => {
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: m.createRole }));
    expect(
      (screen.getByRole("button", { name: m.create }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(actions.createLaborRoleAction).not.toHaveBeenCalled();
  });

  it("renames a role in place", async () => {
    const renamed = { ...CUSTOM, name: "Electrician (lead)" };
    actions.updateLaborRoleAction.mockResolvedValue({ success: true, role: renamed });
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: named(m.editNamed, "Electrician") }));
    fireEvent.change(screen.getByLabelText(m.roleName), {
      target: { value: "Electrician (lead)" },
    });
    fireEvent.click(screen.getByRole("button", { name: m.save }));

    expect(await screen.findByText("Electrician (lead)")).toBeDefined();
    expect(actions.updateLaborRoleAction).toHaveBeenCalledWith("r-custom", {
      name: "Electrician (lead)",
    });
    expect(toast.success).toHaveBeenCalledWith(m.updated);
  });

  it("deletes a role after confirmation", async () => {
    actions.deleteLaborRoleAction.mockResolvedValue({ success: true });
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: named(m.deleteNamed, "Electrician") }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(named(m.confirmDeleteTitle, "Electrician"))).toBeDefined();
    expect(within(dialog).getByText(m.confirmDelete)).toBeDefined();
    expect(actions.deleteLaborRoleAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: m.deleteRole }));

    await waitFor(() => expect(screen.queryByText("Electrician")).toBeNull());
    expect(actions.deleteLaborRoleAction).toHaveBeenCalledWith("r-custom");
    expect(toast.success).toHaveBeenCalledWith(m.deleted);
  });

  it("keeps the dialog up with the backend's reason when a delete is refused", async () => {
    actions.deleteLaborRoleAction.mockResolvedValue({
      success: false,
      error: "forbidden",
      message: "Company admin or manager permission required",
    });
    renderCard();
    await screen.findByText("Electrician");

    fireEvent.click(screen.getByRole("button", { name: named(m.deleteNamed, "Electrician") }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: m.deleteRole }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(m.errors.forbidden);
    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(screen.getByText("Electrician")).toBeDefined();
  });
});
