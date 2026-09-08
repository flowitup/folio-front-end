/**
 * Tests for the member-edit server actions:
 * updateUserProfileAction, removeMemberAction.
 *
 * Covers input validation (UUID / email), error status propagation, and the
 * happy path (delegates to the API wrapper + revalidates). Granting project
 * access is AssignMemberDialog's concern (assignProjectMemberAction).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/assignments", () => ({
  unassignProjectMember: vi.fn(),
}));

vi.mock("@/lib/api/members", () => ({
  removeMember: vi.fn(),
}));

vi.mock("@/lib/api/admin", () => ({
  updateUser: vi.fn(),
}));

vi.mock("@/lib/api/invitations", () => ({
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "11111111-1111-1111-1111-111111111111" },
    accessToken: "test-token",
    expiresAt: Date.now() + 60_000,
  }),
}));

const { updateUserProfileAction, removeMemberAction } = await import("../actions");
const { unassignProjectMember } = await import("@/lib/api/assignments");
const { removeMember } = await import("@/lib/api/members");
const { updateUser } = await import("@/lib/api/admin");
const { revalidatePath } = await import("next/cache");

const mockUnassign = vi.mocked(unassignProjectMember);
const mockRemoveMemberLegacy = vi.mocked(removeMember);
const mockUpdateUser = vi.mocked(updateUser);
const mockRevalidate = vi.mocked(revalidatePath);

const PID = "22222222-2222-2222-2222-222222222222";
const UID = "33333333-3333-3333-3333-333333333333";

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateUserProfileAction", () => {
  it("updates display name + email on success", async () => {
    mockUpdateUser.mockResolvedValue({ id: UID, email: "a@b.com", display_name: "A" });
    await updateUserProfileAction(PID, UID, { email: "a@b.com", display_name: "A" });
    expect(mockUpdateUser).toHaveBeenCalledWith(UID, { email: "a@b.com", display_name: "A" });
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rejects an invalid email with 400", async () => {
    await expect(
      updateUserProfileAction(PID, UID, { email: "not-an-email" })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("propagates a duplicate-email conflict (409)", async () => {
    mockUpdateUser.mockRejectedValue(httpError(409));
    await expect(
      updateUserProfileAction(PID, UID, { email: "dup@b.com" })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("removeMemberAction", () => {
  it("unassigns the member and revalidates", async () => {
    mockUnassign.mockResolvedValue(undefined);
    await removeMemberAction(PID, UID);
    expect(mockUnassign).toHaveBeenCalledWith(PID, UID);
    expect(mockRemoveMemberLegacy).not.toHaveBeenCalled();
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rejects non-UUID ids with 400", async () => {
    await expect(removeMemberAction(PID, "bad")).rejects.toMatchObject({ status: 400 });
    expect(mockUnassign).not.toHaveBeenCalled();
  });

  it("falls back to the legacy /users/<id> removal on a 404 from the assignments endpoint", async () => {
    mockUnassign.mockRejectedValue(httpError(404));
    mockRemoveMemberLegacy.mockResolvedValue(undefined);
    await removeMemberAction(PID, UID);
    expect(mockUnassign).toHaveBeenCalledWith(PID, UID);
    expect(mockRemoveMemberLegacy).toHaveBeenCalledWith(PID, UID);
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("propagates a non-404 error from the assignments endpoint without falling back", async () => {
    mockUnassign.mockRejectedValue(httpError(403));
    await expect(removeMemberAction(PID, UID)).rejects.toMatchObject({ status: 403 });
    expect(mockRemoveMemberLegacy).not.toHaveBeenCalled();
  });

  it("propagates an error from the legacy fallback itself", async () => {
    mockUnassign.mockRejectedValue(httpError(404));
    mockRemoveMemberLegacy.mockRejectedValue(httpError(500));
    await expect(removeMemberAction(PID, UID)).rejects.toMatchObject({ status: 500 });
  });
});
