import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { ProjectMember } from "@/lib/api/members";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ revokeInviteAction: vi.fn(), removeMemberAction: vi.fn() }));
vi.mock("../invite-member-dialog", () => ({ InviteMemberDialog: () => null }));
vi.mock("../edit-member-dialog", () => ({ EditMemberDialog: () => null }));
vi.mock("@/components/projects/assign-member-dialog", () => ({ AssignMemberDialog: () => null }));

import { MembersTable } from "../members-table";

function renderTable(members: ProjectMember[]) {
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
        canEditIdentity={false}
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
});
