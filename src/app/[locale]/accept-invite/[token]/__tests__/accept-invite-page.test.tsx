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
});
