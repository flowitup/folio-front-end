/**
 * Tests for the member-edit server actions:
 * updateMemberRoleAction, updateUserProfileAction, removeMemberAction.
 *
 * Covers input validation (UUID / email), error status propagation, and the
 * happy path (delegates to the API wrapper + revalidates).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/members", () => ({
  updateMemberRole: vi.fn(),
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

const { updateMemberRoleAction, updateUserProfileAction, removeMemberAction } =
  await import("../actions");
const { updateMemberRole, removeMember } = await import("@/lib/api/members");
const { updateUser } = await import("@/lib/api/admin");
const { revalidatePath } = await import("next/cache");

const mockUpdateRole = vi.mocked(updateMemberRole);
const mockRemove = vi.mocked(removeMember);
const mockUpdateUser = vi.mocked(updateUser);
const mockRevalidate = vi.mocked(revalidatePath);

const PID = "22222222-2222-2222-2222-222222222222";
const UID = "33333333-3333-3333-3333-333333333333";
const RID = "44444444-4444-4444-4444-444444444444";

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateMemberRoleAction", () => {
  it("delegates to the API and revalidates on success", async () => {
    mockUpdateRole.mockResolvedValue({ user_id: UID, role_id: RID, role_name: "manager" });
    await updateMemberRoleAction(PID, UID, RID);
    expect(mockUpdateRole).toHaveBeenCalledWith(PID, UID, RID);
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rejects non-UUID ids with 400 before any API call", async () => {
    await expect(updateMemberRoleAction("nope", UID, RID)).rejects.toMatchObject({ status: 400 });
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it("propagates the API error status (403)", async () => {
    mockUpdateRole.mockRejectedValue(httpError(403));
    await expect(updateMemberRoleAction(PID, UID, RID)).rejects.toMatchObject({ status: 403 });
  });
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
  it("removes the member and revalidates", async () => {
    mockRemove.mockResolvedValue(undefined);
    await removeMemberAction(PID, UID);
    expect(mockRemove).toHaveBeenCalledWith(PID, UID);
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rejects non-UUID ids with 400", async () => {
    await expect(removeMemberAction(PID, "bad")).rejects.toMatchObject({ status: 400 });
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
