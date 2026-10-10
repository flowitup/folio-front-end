import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { ProjectMember } from "@/lib/api/members";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { mockRemove, mockToastError } = vi.hoisted(() => ({
  mockRemove: vi.fn(),
  mockToastError: vi.fn(),
}));
vi.mock("../actions", () => ({ revokeInviteAction: vi.fn(), removeMemberAction: mockRemove }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mockToastError, warning: vi.fn() } }));
vi.mock("../invite-member-dialog", () => ({ InviteMemberDialog: () => null }));
vi.mock("../edit-member-dialog", () => ({ EditMemberDialog: () => null }));
vi.mock("@/components/projects/assign-member-dialog", () => ({ AssignMemberDialog: () => null }));

import { MembersTable } from "../members-table";

function renderTable(members: ProjectMember[], canEditIdentity = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MembersTable
        projectId="p1"
        companyId="c1"
        members={members}
        invites={[]}
        canInvite
        canManageMembers
        canAssignMembers
        callerIsCompanyAdmin
        canEditIdentity={canEditIdentity}
        currentUserId="me"
      />
    </NextIntlClientProvider>
  );
}

describe("MembersTable", () => {
  it("shows a phone-only member's phone, never the synthetic address", () => {
    renderTable([
      {
        user_id: "u1",
        email: "phone-33600000097@no-email.folio.flowitup.com",
        display_name: null,
        joined_at: "2026-09-01T00:00:00Z",
      },
      {
        user_id: "u2",
        email: "dave@example.com",
        display_name: "Dave",
        joined_at: "2026-09-01T00:00:00Z",
      },
    ]);
    expect(document.body.textContent).not.toContain("no-email");
    expect(screen.getAllByText("+336 00 00 00 97").length).toBeGreaterThan(0);
    expect(screen.getAllByText("dave@example.com").length).toBeGreaterThan(0);
  });

  it("names a failed removal as a removal and keeps a 403 distinct", async () => {
    const dave = {
      user_id: "u2",
      email: "dave@example.com",
      display_name: "Dave",
      joined_at: "2026-09-01T00:00:00Z",
    };

    mockRemove.mockResolvedValueOnce({ ok: false, status: 500 });
    const { unmount } = renderTable([dave]);
    await userEvent.click(screen.getAllByRole("button", { name: en.members.edit.remove })[0]);
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en.members.edit.remove }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(en.members.edit.toast.removeFailed)
    );
    unmount();

    mockRemove.mockResolvedValueOnce({ ok: false, status: 403 });
    renderTable([dave]);
    await userEvent.click(screen.getAllByRole("button", { name: en.members.edit.remove })[0]);
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: en.members.edit.remove }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(en.members.edit.toast.forbidden)
    );
  });

  it("offers Edit only to callers who may change a member's name and email", () => {
    const dave = { user_id: "u2", email: "dave@example.com", display_name: "Dave", joined_at: "2026-09-01T00:00:00Z" };
    const { unmount } = renderTable([dave]);
    expect(screen.queryByRole("button", { name: en.members.edit.button })).toBeNull();
    expect(screen.getAllByRole("button", { name: en.members.edit.remove }).length).toBeGreaterThan(0);
    unmount();
    renderTable([dave], true);
    expect(screen.getAllByRole("button", { name: en.members.edit.button }).length).toBeGreaterThan(0);
  });

  it("shows each member's company role", () => {
    renderTable([
      { user_id: "u1", email: "a@example.com", display_name: "Ann", role_name: "admin", joined_at: "2026-09-01T00:00:00Z" },
      { user_id: "u2", email: "m@example.com", display_name: "Max", role_name: "manager", joined_at: "2026-09-01T00:00:00Z" },
    ]);
    expect(screen.getByRole("columnheader", { name: en.members.col.role })).toBeInTheDocument();
    expect(screen.getAllByText(en.members.roles.admin).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.members.roles.manager).length).toBeGreaterThan(0);
  });

  it("shows no invitations section to a read-only member", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MembersTable
          projectId="p1"
          companyId="c1"
          members={[]}
          invites={[]}
          canInvite={false}
          canManageMembers={false}
          canAssignMembers={false}
          callerIsCompanyAdmin={false}
          canEditIdentity={false}
          currentUserId="me"
        />
      </NextIntlClientProvider>
    );
    expect(screen.queryByText(en.members.tab.pending)).toBeNull();
    expect(screen.queryByText(en.members.empty.pending)).toBeNull();
  });

  it("marks an invitation past its expiry as expired", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MembersTable
          projectId="p1"
          companyId="c1"
          members={[]}
          invites={[
            {
              id: "i1",
              email: "late@example.com",
              expires_at: "2020-01-01T00:00:00Z",
              invited_by_name: "Ann",
            } as never,
          ]}
          canInvite
          canManageMembers={false}
          canAssignMembers={false}
          callerIsCompanyAdmin={false}
          canEditIdentity={false}
          currentUserId="me"
        />
      </NextIntlClientProvider>
    );
    expect(screen.getAllByText(en.members.expired).length).toBeGreaterThan(0);
  });

  it("heads the remaining time with 'Expire dans' and labels it and the inviter on phone cards", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <MembersTable
          projectId="p1"
          companyId="c1"
          members={[]}
          invites={[
            {
              id: "i1",
              email: "new@example.com",
              // Just under 7 days left, so it rounds up to 7.
              expires_at: new Date(Date.now() + 7 * 86_400_000 - 60_000).toISOString(),
              invited_by_name: "Ann",
            } as never,
          ]}
          canInvite
          canManageMembers={false}
          canAssignMembers={false}
          callerIsCompanyAdmin={false}
          canEditIdentity={false}
          currentUserId="me"
        />
      </NextIntlClientProvider>
    );
    // "Expire le" (expires on) announced a date above a duration.
    expect(screen.getByRole("columnheader", { name: "Expire dans" })).toBeInTheDocument();
    expect(within(screen.getByTestId("invites-desktop")).getByText("7 jours")).toBeInTheDocument();
    const meta = screen.getByTestId("invite-card-meta");
    expect(meta).toHaveTextContent("Expire dans 7 jours");
    expect(meta).toHaveTextContent("Invité par Ann");
  });

  it("lets the header and its buttons wrap on narrow screens", () => {
    renderTable([]);
    const header = screen.getByTestId("members-header");
    expect(header.className).toContain("flex-wrap");
    expect((header.lastElementChild as HTMLElement).className).toContain("flex-wrap");
    expect(header.parentElement!.className).toContain("px-4");
  });

  it("asks in an in-app dialog, not the browser's confirm(), before removing", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mockRemove.mockClear();
    mockRemove.mockResolvedValue({ ok: true });
    renderTable([{ user_id: "u2", email: "dave@example.com", display_name: "Dave", joined_at: "2026-09-01T00:00:00Z" }]);
    await userEvent.click(screen.getAllByRole("button", { name: en.members.edit.remove })[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Remove Dave from this project?");
    await userEvent.click(within(dialog).getByRole("button", { name: en.members.invite.cancel }));
    expect(mockRemove).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("lets a manager remove only company members, as the API does", () => {
    const at = "2026-09-01T00:00:00Z";
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MembersTable
          projectId="p1"
          companyId="c1"
          members={[
            { user_id: "me", email: "alice@example.com", display_name: "Alice", role_name: "manager", joined_at: at },
            { user_id: "u-dave", email: "dave@example.com", display_name: "Dave", role_name: "member", joined_at: at },
            { user_id: "u-bob", email: "bob@example.com", display_name: "Bob", role_name: "manager", joined_at: at },
            { user_id: "u-ann", email: "ann@example.com", display_name: "Ann", role_name: "admin", joined_at: at },
            { user_id: "u-gone", email: "gone@example.com", display_name: "Gone", role_name: null, joined_at: at },
          ]}
          invites={[]}
          canInvite
          canManageMembers
          canAssignMembers
          callerIsCompanyAdmin={false}
          canEditIdentity={false}
          currentUserId="me"
        />
      </NextIntlClientProvider>
    );
    const rows = within(screen.getByTestId("members-desktop")).getAllByRole("row").slice(1);
    const removeIn = (name: string) =>
      within(rows.find((r) => within(r).queryByText(name))!).getByRole("button", { name: en.members.edit.remove });

    expect(removeIn("Dave")).toBeEnabled();
    for (const name of ["Bob", "Ann", "Gone"]) {
      expect(removeIn(name)).toBeDisabled();
      expect(removeIn(name)).toHaveAttribute("title", en.members.edit.removeOnlyAdmin);
    }
    // Their own row stays disabled, without the admin-only reason.
    expect(removeIn("Alice")).toBeDisabled();
    expect(removeIn("Alice")).not.toHaveAttribute("title");
    // The phone layout follows the same rule.
    const mobileRemoves = within(screen.getByTestId("members-mobile")).getAllByRole("button", {
      name: en.members.edit.remove,
    });
    expect(mobileRemoves.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false, true, true, true]);
  });

  it("lets a company admin remove anyone but themselves", () => {
    const at = "2026-09-01T00:00:00Z";
    renderTable([
      { user_id: "me", email: "ann@example.com", display_name: "Ann", role_name: "admin", joined_at: at },
      { user_id: "u-bob", email: "bob@example.com", display_name: "Bob", role_name: "manager", joined_at: at },
      { user_id: "u-gone", email: "gone@example.com", display_name: "Gone", role_name: null, joined_at: at },
    ]);
    const removes = within(screen.getByTestId("members-desktop")).getAllByRole("button", {
      name: en.members.edit.remove,
    });
    expect(removes.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false, false]);
  });
});
