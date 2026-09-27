import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const dave = {
      user_id: "u2",
      email: "dave@example.com",
      display_name: "Dave",
      joined_at: "2026-09-01T00:00:00Z",
    };

    mockRemove.mockResolvedValueOnce({ ok: false, status: 500 });
    const { unmount } = renderTable([dave]);
    await userEvent.click(screen.getAllByRole("button", { name: en.members.edit.remove })[0]);
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(en.members.edit.toast.removeFailed)
    );
    unmount();

    mockRemove.mockResolvedValueOnce({ ok: false, status: 403 });
    renderTable([dave]);
    await userEvent.click(screen.getAllByRole("button", { name: en.members.edit.remove })[0]);
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

  it("lets the header and its buttons wrap on narrow screens", () => {
    renderTable([]);
    const header = screen.getByTestId("members-header");
    expect(header.className).toContain("flex-wrap");
    expect((header.lastElementChild as HTMLElement).className).toContain("flex-wrap");
    expect(header.parentElement!.className).toContain("px-4");
  });
});
