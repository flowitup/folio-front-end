import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockVerify, redirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVerify: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/api/invitations", () => ({ verifyInvite: mockVerify }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../accept-invite-form", () => ({ AcceptInviteForm: () => null }));
vi.mock("../invite-error", () => ({ InviteError: () => null }));
vi.mock("../logged-in-other", () => ({ LoggedInOther: () => null }));
vi.mock("../join-as-invitee", () => ({ JoinAsInvitee: () => null }));

import AcceptInvitePage from "../page";

const params = Promise.resolve({ token: "tok", locale: "fr" });

beforeEach(() => vi.clearAllMocks());

describe("AcceptInvitePage with a session", () => {
  it("goes to the dashboard once the invitation is accepted instead of flashing 'signed in as someone else'", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "a@example.com", display_name: "Ann" } });
    mockVerify.mockResolvedValue({ error: "accepted" });
    await expect(AcceptInvitePage({ params })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/fr/dashboard");
  });

  it("names a phone-only account by name, never its synthetic address", async () => {
    mockGetSession.mockResolvedValue({
      user: { email: "phone-33600000097@no-email.folio.flowitup.com", display_name: "Dave", phone: "+33600000097" },
    });
    mockVerify.mockResolvedValue({ email: "x@example.com", role_name: "member" });
    const el = (await AcceptInvitePage({ params })) as { props: { currentEmail: string } };
    expect(el.props.currentEmail).toBe("Dave");
  });

  it("lets the invited account itself join from its session instead of asking it to sign out", async () => {
    const { JoinAsInvitee } = await import("../join-as-invitee");
    const { LoggedInOther } = await import("../logged-in-other");
    mockGetSession.mockResolvedValue({ user: { email: "Invitee@Example.com", display_name: "Invité Six" } });
    mockVerify.mockResolvedValue({ email: "invitee@example.com", project_name: "1 rue Principale", role_name: "member" });
    const el = (await AcceptInvitePage({ params })) as {
      type: unknown;
      props: { token: string; locale: string; projectName: string; currentUser: string };
    };
    expect(el.type).toBe(JoinAsInvitee);
    expect(el.type).not.toBe(LoggedInOther);
    expect(el.props).toEqual({ token: "tok", locale: "fr", projectName: "1 rue Principale", currentUser: "Invité Six" });
  });

  it("still asks another account to sign out", async () => {
    const { LoggedInOther } = await import("../logged-in-other");
    mockGetSession.mockResolvedValue({ user: { email: "someone@example.com", display_name: "Someone" } });
    mockVerify.mockResolvedValue({ email: "invitee@example.com", project_name: "P", role_name: "member" });
    const el = (await AcceptInvitePage({ params })) as { type: unknown; props: { returnPath: string } };
    expect(el.type).toBe(LoggedInOther);
    // Signing out comes back to this invitation.
    expect(el.props.returnPath).toBe("/fr/accept-invite/tok");
  });

  it.each(["not_found", "expired", "revoked"])(
    "says a %s link is unavailable instead of asking to sign out first",
    async (reason) => {
      const { InviteError } = await import("../invite-error");
      mockGetSession.mockResolvedValue({ user: { email: "someone@example.com", display_name: "Someone" } });
      mockVerify.mockResolvedValue({ error: reason });
      const el = (await AcceptInvitePage({ params })) as { type: unknown; props: { reason: string; locale: string } };
      expect(el.type).toBe(InviteError);
      expect(el.props).toEqual({ reason, locale: "fr" });
    }
  );
});
