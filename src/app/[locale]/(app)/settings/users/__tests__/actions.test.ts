/**
 * Tests for admin/users server actions.
 *
 * Covers (review fixes):
 * - M2 + N1: classifyBackendError maps body fields to discriminated i18n keys
 *   (403 forbidden vs roleNotAllowed; 404 user vs role; 422 tooMany vs generic).
 * - M3: empty projectIds returns "projectsRequired" (matches existing i18n key).
 * - M5: action-level happy-path — pass-through of results array on 200.
 *
 * The underlying lib/api/admin wrappers are mocked so we can shape thrown
 * errors with both `.status` and `.body` (the populated fields are what
 * classifyBackendError inspects).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks ----

vi.mock("@/lib/api/admin", () => ({
  bulkAddMemberships: vi.fn(),
  searchUsers: vi.fn(),
}));

// ---- Imports (after mocks) ----

const { bulkAddMembershipsAction, searchUsersAction } = await import("../actions");
const { bulkAddMemberships, searchUsers } = await import("@/lib/api/admin");
const mockBulkAdd = vi.mocked(bulkAddMemberships);
const mockSearch = vi.mocked(searchUsers);

// ---- Helpers ----

function httpError(
  status: number,
  body: { error?: string; message?: string } | null = null
): Error & { status: number; body: typeof body } {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    body: typeof body;
  };
  err.status = status;
  err.body = body;
  return err;
}

const VALID_USER = "11111111-1111-1111-1111-111111111111";
const VALID_PROJECT = "22222222-2222-2222-2222-222222222222";
const VALID_ROLE = "33333333-3333-3333-3333-333333333333";

// ---- Tests ----

describe("bulkAddMembershipsAction — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-UUID userId with userNotFound", async () => {
    const result = await bulkAddMembershipsAction("not-a-uuid", [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "userNotFound" });
    expect(mockBulkAdd).not.toHaveBeenCalled();
  });

  it("rejects non-UUID roleId with roleNotFound", async () => {
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], "bad-role");
    expect(result).toEqual({ success: false, error: "roleNotFound" });
    expect(mockBulkAdd).not.toHaveBeenCalled();
  });

  it("rejects empty projectIds with projectsRequired (M3 i18n key)", async () => {
    const result = await bulkAddMembershipsAction(VALID_USER, [], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "projectsRequired" });
    expect(mockBulkAdd).not.toHaveBeenCalled();
  });

  it("rejects >50 projects with tooMany", async () => {
    const ids = Array.from({ length: 51 }, (_, i) =>
      `${"4".repeat(8)}-${"4".repeat(4)}-${"4".repeat(4)}-${"4".repeat(4)}-${i.toString().padStart(12, "0")}`
    );
    const result = await bulkAddMembershipsAction(VALID_USER, ids, VALID_ROLE);
    expect(result).toEqual({ success: false, error: "tooMany" });
    expect(mockBulkAdd).not.toHaveBeenCalled();
  });

  it("rejects non-UUID project entries with generic", async () => {
    const result = await bulkAddMembershipsAction(VALID_USER, ["not-uuid"], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "generic" });
    expect(mockBulkAdd).not.toHaveBeenCalled();
  });
});

describe("bulkAddMembershipsAction — backend error mapping (M2 + N1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("403 with 'superadmin' in message → roleNotAllowed", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(403, { error: "Forbidden", message: "Cannot assign superadmin role." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "roleNotAllowed" });
  });

  it("403 generic → forbidden", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(403, { error: "Forbidden", message: "Permission denied." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 with 'role' in message → roleNotFound", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(404, { message: "Role not found." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "roleNotFound" });
  });

  it("404 without 'role' in message → userNotFound", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(404, { message: "Target user not found." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "userNotFound" });
  });

  it("400 → tooMany (rare; FE pre-validates)", async () => {
    mockBulkAdd.mockRejectedValueOnce(httpError(400, { message: "Empty list" }));
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "tooMany" });
  });

  it("422 with 'project_ids' in message → tooMany", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(422, { message: "Validation failed: project_ids must have at most 50 items." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "tooMany" });
  });

  it("422 generic → generic", async () => {
    mockBulkAdd.mockRejectedValueOnce(
      httpError(422, { message: "Some other validation issue." })
    );
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "generic" });
  });

  it("429 → rateLimited", async () => {
    mockBulkAdd.mockRejectedValueOnce(httpError(429, { message: "Too many requests." }));
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockBulkAdd.mockRejectedValueOnce(httpError(500, null));
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "generic" });
  });

  it("missing body still classifies by status (403 → forbidden)", async () => {
    mockBulkAdd.mockRejectedValueOnce(httpError(403, null));
    const result = await bulkAddMembershipsAction(VALID_USER, [VALID_PROJECT], VALID_ROLE);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });
});

describe("bulkAddMembershipsAction — happy path (M5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards user_id, project_ids, role_id and returns the results array", async () => {
    mockBulkAdd.mockResolvedValueOnce({
      results: [
        { project_id: VALID_PROJECT, project_name: "P1", status: "added" },
      ],
    });
    const result = await bulkAddMembershipsAction(
      VALID_USER,
      [VALID_PROJECT],
      VALID_ROLE
    );
    expect(mockBulkAdd).toHaveBeenCalledWith(VALID_USER, {
      project_ids: [VALID_PROJECT],
      role_id: VALID_ROLE,
    });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0].status).toBe("added");
  });

  it("preserves mixed-status batch results", async () => {
    mockBulkAdd.mockResolvedValueOnce({
      results: [
        { project_id: VALID_PROJECT, project_name: "P1", status: "added" },
        {
          project_id: "55555555-5555-5555-5555-555555555555",
          project_name: "P2",
          status: "already_member_same_role",
        },
        {
          project_id: "66666666-6666-6666-6666-666666666666",
          project_name: null,
          status: "project_not_found",
        },
      ],
    });
    const result = await bulkAddMembershipsAction(
      VALID_USER,
      [
        VALID_PROJECT,
        "55555555-5555-5555-5555-555555555555",
        "66666666-6666-6666-6666-666666666666",
      ],
      VALID_ROLE
    );
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results?.map((r) => r.status)).toEqual([
      "added",
      "already_member_same_role",
      "project_not_found",
    ]);
  });
});

describe("searchUsersAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty for queries shorter than 3 chars (no API call)", async () => {
    expect(await searchUsersAction("")).toEqual({ items: [] });
    expect(await searchUsersAction("ab")).toEqual({ items: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("rejects queries longer than 100 chars with queryTooLong", async () => {
    const result = await searchUsersAction("x".repeat(101));
    expect(result).toEqual({ items: [], error: "queryTooLong" });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("forwards the query and returns items on success", async () => {
    mockSearch.mockResolvedValueOnce([
      { id: VALID_USER, email: "alice@example.com", display_name: "Alice" },
    ]);
    const result = await searchUsersAction("alice");
    expect(mockSearch).toHaveBeenCalledWith("alice");
    expect(result.items).toHaveLength(1);
    expect(result.error).toBeUndefined();
  });

  it("returns generic error on backend failure", async () => {
    mockSearch.mockRejectedValueOnce(httpError(500, null));
    const result = await searchUsersAction("alice");
    expect(result).toEqual({ items: [], error: "generic" });
  });
});
