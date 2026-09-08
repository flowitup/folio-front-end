/**
 * Tests for InviteMemberDialog component.
 *
 * No role picker (roles-permissions-redesign): every outsider invite is sent
 * as the fixed "member" role id resolved by the parent (MembersTable). Role
 * assignment/promotion happens post-join via AssignMemberDialog or Settings ›
 * Company.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteMemberDialog } from "../invite-member-dialog";

// Mock server action
vi.mock("../actions", () => ({
  inviteMemberAction: vi.fn(),
  revokeInviteAction: vi.fn(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const t: Record<string, string> = {
      "invite.dialogTitle": "Invite a new member",
      "invite.emailLabel": "Email address",
      "invite.submit": "Send invitation",
      "invite.submitting": "Sending...",
      "invite.cancel": "Cancel",
      "toast.inviteSent": `Invitation sent to ${params?.email ?? ""}`,
      "toast.directAdded": `${params?.email ?? ""} was added directly to the project`,
      "toast.alreadyInvited": `An invitation is already pending for ${params?.email ?? ""}`,
      "toast.rateLimited": "Too many invitations. Try again later.",
      "toast.error": "Could not send invitation. Please try again.",
    };
    return t[key] ?? key;
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation (router)
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { inviteMemberAction } = await import("../actions");
const mockInviteAction = vi.mocked(inviteMemberAction);

const { toast } = await import("sonner");
// Cast through `unknown` because the runtime toast object is mocked via
// vi.mock (above), but TypeScript still sees its real type — the narrow
// shape we use here is all the test calls.
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

const MEMBER_ROLE_ID = "role-member-1";

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(
    <InviteMemberDialog
      open={open}
      onOpenChange={onOpenChange}
      projectId="proj-123"
      memberRoleId={MEMBER_ROLE_ID}
    />
  );
}

describe("InviteMemberDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders only an email input when open — no role picker", () => {
      renderDialog();
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
      expect(screen.queryByRole("combobox")).toBeNull();
    });

    it("submit button is disabled when email is empty", () => {
      renderDialog();
      const submitBtn = screen.getByRole("button", { name: /send invitation/i });
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("Submission", () => {
    async function fillAndSubmit(email = "new@example.com") {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/email address/i), email);
      await user.click(screen.getByRole("button", { name: /send invitation/i }));
    }

    it("calls inviteMemberAction with the fixed member role id", async () => {
      mockInviteAction.mockResolvedValueOnce({
        kind: "invitation_sent",
        invitation_id: "inv-1",
        expires_at: "2099-01-01",
      });

      await fillAndSubmit("new@example.com");

      await waitFor(() => {
        expect(mockInviteAction).toHaveBeenCalledWith(
          "proj-123",
          "new@example.com",
          MEMBER_ROLE_ID
        );
      });
    });

    it("shows success toast on resolve with kind=invitation_sent", async () => {
      mockInviteAction.mockResolvedValueOnce({
        kind: "invitation_sent",
        invitation_id: "inv-1",
        expires_at: "2099-01-01",
      });

      await fillAndSubmit("new@example.com");

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining("new@example.com")
        );
      });
    });

    it("shows direct-added toast on kind=direct_added", async () => {
      mockInviteAction.mockResolvedValueOnce({
        kind: "direct_added",
        user_id: "user-99",
      });

      await fillAndSubmit("existing@example.com");

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining("existing@example.com")
        );
      });
    });

    it("shows alreadyInvited warning on 409 error", async () => {
      const err = Object.assign(new Error("Conflict"), { status: 409 });
      mockInviteAction.mockRejectedValueOnce(err);

      await fillAndSubmit("dupe@example.com");

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining("dupe@example.com")
        );
      });
    });

    it("shows rateLimited error on 429", async () => {
      const err = Object.assign(new Error("Rate limit"), { status: 429 });
      mockInviteAction.mockRejectedValueOnce(err);

      await fillAndSubmit("ratelimited@example.com");

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining("Too many invitations")
        );
      });
    });

    it("shows generic error on unknown error", async () => {
      const err = Object.assign(new Error("Internal"), { status: 500 });
      mockInviteAction.mockRejectedValueOnce(err);

      await fillAndSubmit("bad@example.com");

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining("Could not send invitation")
        );
      });
    });
  });
});
