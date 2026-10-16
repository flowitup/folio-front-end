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

  it("names a phone-only account by name, never its synthetic address, and lets it join", async () => {
    const { JoinAsInvitee } = await import("../join-as-invitee");
    mockGetSession.mockResolvedValue({
      user: { email: "phone-33600000097@no-email.folio.flowitup.com", display_name: "Dave", phone: "+33600000097" },
    });
    mockVerify.mockResolvedValue({ email: "x@example.com", project_name: "P", role_name: "member" });
    const el = (await AcceptInvitePage({ params })) as { type: unknown; props: { currentUser: string; isInvitee: boolean } };
    expect(el.type).toBe(JoinAsInvitee);
    expect(el.props.currentUser).toBe("Dave");
    expect(el.props.isInvitee).toBe(false);
  });

  it("lets the invited account itself join from its session", async () => {
    const { JoinAsInvitee } = await import("../join-as-invitee");
    mockGetSession.mockResolvedValue({ user: { email: "Invitee@Example.com", display_name: "Invité Six" } });
    mockVerify.mockResolvedValue({ email: "invitee@example.com", project_name: "1 rue Principale", role_name: "member" });
    const el = (await AcceptInvitePage({ params })) as {
      type: unknown;
      props: Record<string, unknown>;
    };
    expect(el.type).toBe(JoinAsInvitee);
    expect(el.props).toEqual({
      token: "tok",
      locale: "fr",
      projectName: "1 rue Principale",
      currentUser: "Invité Six",
      isInvitee: true,
      returnPath: "/fr/accept-invite/tok",
    });
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
