/**
 * Tests for tags API wrapper (server-only).
 * Covers: listTags, createTag, updateTag, deleteTag, getTagSummary.
 * Tests happy path + error paths (non-OK response → buildHttpError).
 * Mocks fetch; validates URL construction, headers, method, body serialization.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getTagSummary,
  type ProjectTag,
  type TagListResult,
  type TagSummaryResult,
} from "../tags";

// ---- Module mocks ----

vi.mock("@/lib/config/env", () => ({
  env: {
    apiBaseUrl: "http://api.test",
  },
}));

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({
    Authorization: "Bearer test-token",
  }),
}));

// ---- Helpers ----

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, body?: unknown): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- Fixtures ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const TAG_ID = "22222222-2222-2222-2222-222222222222";

function makeTag(id = TAG_ID, name = "Excavation"): ProjectTag {
  return {
    id,
    project_id: PROJECT_ID,
    name,
    color: "#ef4444",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

// ---- listTags ----

describe("listTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GETs /projects/{projectId}/tags and returns items", async () => {
    const tag1 = makeTag("tag-1", "Excavation");
    const tag2 = makeTag("tag-2", "Foundation");
    const mockResult: TagListResult = {
      items: [tag1, tag2],
      count: 2,
    };

    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockResult));

    const result = await listTags(PROJECT_ID);

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`http://api.test/projects/${PROJECT_ID}/tags`);
    expect(opts.method).toBe("GET");
    expect(result).toEqual(mockResult);
  });

  it("includes auth header in request", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ items: [], count: 0 })
    );

    await listTags(PROJECT_ID);

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(opts.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
  });

  it("encodes projectId in URL path", async () => {
    const encodedId = "proj-with-special%2Fchars";
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ items: [], count: 0 })
    );

    await listTags("proj-with-special/chars");

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain(encodedId);
  });

  it("throws on non-OK response with 404 error body", async () => {
    const errorBody = { error: "Project not found" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(404, errorBody));

    const err = await listTags(PROJECT_ID).catch((e) => e);
    expect(err.message).toContain("Failed to list tags");
    expect(err.status).toBe(404);
    expect(err.body).toEqual(errorBody);
  });

  it("handles non-JSON response body gracefully (500 error)", async () => {
    const mockJson = vi.fn().mockRejectedValue(new Error("Not JSON"));
    const errorResponse = new Response("Internal Server Error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
    Object.defineProperty(errorResponse, "json", { value: mockJson });

    global.fetch = vi.fn().mockResolvedValueOnce(errorResponse);

    const err = await listTags(PROJECT_ID).catch((e) => e);
    expect(err.message).toContain("Failed to list tags");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    await expect(listTags(PROJECT_ID)).rejects.toThrow("Network error listing tags");
  });
});

// ---- createTag ----

describe("createTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs to /projects/{projectId}/tags with name + color", async () => {
    const created = makeTag();
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(created));

    const result = await createTag(PROJECT_ID, {
      name: "Excavation",
      color: "#ef4444",
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`http://api.test/projects/${PROJECT_ID}/tags`);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Excavation",
      color: "#ef4444",
    });
    expect(result).toEqual(created);
  });

  it("throws 400 validation error from server", async () => {
    const errorBody = { error: "Invalid color format" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(400, errorBody));

    const err = await createTag(PROJECT_ID, {
      name: "Test",
      color: "not-a-color",
    }).catch((e) => e);
    expect(err.message).toContain("Failed to create tag");
  });

  it("throws 409 duplicate error", async () => {
    const errorBody = { message: "Tag name already exists" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(409, errorBody));

    const err = await createTag(PROJECT_ID, { name: "Duplicate", color: "#ef4444" }).catch(
      (e) => e
    );
    expect(err.message).toContain("Failed to create tag");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection reset"));

    await expect(
      createTag(PROJECT_ID, { name: "Test", color: "#ef4444" })
    ).rejects.toThrow("Network error creating tag");
  });
});

// ---- updateTag ----

describe("updateTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUTs to /projects/{projectId}/tags/{tagId} with patch payload", async () => {
    const updated = makeTag("tag-1", "Updated Name");
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(updated));

    const result = await updateTag(PROJECT_ID, TAG_ID, {
      name: "Updated Name",
      color: "#3b82f6",
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`http://api.test/projects/${PROJECT_ID}/tags/${TAG_ID}`);
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body as string)).toEqual({
      name: "Updated Name",
      color: "#3b82f6",
    });
    expect(result).toEqual(updated);
  });

  it("allows partial updates (name only)", async () => {
    const updated = makeTag(TAG_ID, "New Name");
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(updated));

    await updateTag(PROJECT_ID, TAG_ID, { name: "New Name" });

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(opts.body as string)).toEqual({ name: "New Name" });
  });

  it("encodes tagId in URL path", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(makeTag()));

    await updateTag(PROJECT_ID, "tag-with-special%2Fchars", { name: "X" });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("tag-with-special%252Fchars");
  });

  it("throws 404 not found", async () => {
    const errorBody = { error: "Tag not found" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(404, errorBody));

    const err = await updateTag(PROJECT_ID, "nonexistent-id", { name: "X" }).catch(
      (e) => e
    );
    expect(err.message).toContain("Failed to update tag");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

    await expect(
      updateTag(PROJECT_ID, TAG_ID, { name: "X" })
    ).rejects.toThrow("Network error updating tag");
  });
});

// ---- deleteTag ----

describe("deleteTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DELETEs /projects/{projectId}/tags/{tagId}", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response("", { status: 200 }));

    await deleteTag(PROJECT_ID, TAG_ID);

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`http://api.test/projects/${PROJECT_ID}/tags/${TAG_ID}`);
    expect(opts.method).toBe("DELETE");
  });

  it("resolves to void on success", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response("", { status: 200 }));

    const result = await deleteTag(PROJECT_ID, TAG_ID);
    expect(result).toBeUndefined();
  });

  it("throws 403 forbidden", async () => {
    const errorBody = { error: "Not authorized to delete" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(403, errorBody));

    const err = await deleteTag(PROJECT_ID, TAG_ID).catch((e) => e);
    expect(err.message).toContain("Failed to delete tag");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    await expect(deleteTag(PROJECT_ID, TAG_ID)).rejects.toThrow(
      "Network error deleting tag"
    );
  });
});

// ---- getTagSummary ----

describe("getTagSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GETs /projects/{projectId}/tag-summary and returns summary rows", async () => {
    const mockResult: TagSummaryResult = {
      rows: [
        {
          tag_id: TAG_ID,
          tag_name: "Excavation",
          tag_color: "#ef4444",
          labor_cost: 5000,
          expense_total: 2000,
          labor_entry_count: 10,
          invoice_count: 2,
        },
        {
          tag_id: null,
          tag_name: null,
          tag_color: null,
          labor_cost: 1000,
          expense_total: 500,
          labor_entry_count: 5,
          invoice_count: 1,
        },
      ],
      count: 2,
    };

    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockResult));

    const result = await getTagSummary(PROJECT_ID);

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`http://api.test/projects/${PROJECT_ID}/tag-summary`);
    expect(opts.method).toBe("GET");
    expect(result).toEqual(mockResult);
  });

  it("returns empty rows when no tags or labor", async () => {
    const mockResult: TagSummaryResult = {
      rows: [],
      count: 0,
    };

    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockResult));

    const result = await getTagSummary(PROJECT_ID);
    expect(result.rows).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("includes auth header in request", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ rows: [], count: 0 }));

    await getTagSummary(PROJECT_ID);

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(opts.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });

  it("throws 404 project not found", async () => {
    const errorBody = { error: "Project not found" };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(404, errorBody));

    const err = await getTagSummary(PROJECT_ID).catch((e) => e);
    expect(err.message).toContain("Failed to fetch tag summary");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("DNS resolution failed"));

    await expect(getTagSummary(PROJECT_ID)).rejects.toThrow(
      "Network error fetching tag summary"
    );
  });
});
