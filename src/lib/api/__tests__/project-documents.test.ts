/**
 * Tests for the project-documents API wrapper — the uploader filter's two ends:
 * - listDocumentUploaders: GET /projects/<id>/documents/uploaders, unwraps `items`
 * - listProjectDocuments: sends the chosen uploader as `uploader_id`
 *
 * Pattern mirrors project-photos.test.ts: global.fetch = vi.fn() in beforeEach.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Module mocks (hoisted before imports by Vitest) ----

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

import { listDocumentUploaders, listProjectDocuments } from "../project-documents";

// ---- Helpers ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const UPLOADER_ID = "33333333-3333-3333-3333-333333333333";

function mockFetch() {
  return global.fetch as ReturnType<typeof vi.fn>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---- Setup ----

let originalFetch: typeof global.fetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

// ---- listDocumentUploaders ----

describe("listDocumentUploaders", () => {
  it("calls the uploaders endpoint with the session auth header", async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ items: [] }));

    await listDocumentUploaders(PROJECT_ID);

    const [url, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/projects/${PROJECT_ID}/documents/uploaders`);
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("returns the items the backend lists", async () => {
    const items = [
      { user_id: UPLOADER_ID, display_name: "Alice" },
      { user_id: "44444444-4444-4444-4444-444444444444", display_name: "bob@example.com" },
    ];
    mockFetch().mockResolvedValueOnce(jsonResponse({ items }));

    await expect(listDocumentUploaders(PROJECT_ID)).resolves.toEqual(items);
  });

  it("returns an empty list when the body has no items", async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({}));

    await expect(listDocumentUploaders(PROJECT_ID)).resolves.toEqual([]);
  });

  it("throws an error carrying the HTTP status on a non-2xx response", async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(listDocumentUploaders(PROJECT_ID)).rejects.toMatchObject({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("wraps a network failure", async () => {
    mockFetch().mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(listDocumentUploaders(PROJECT_ID)).rejects.toThrow(
      "Network error listing uploaders"
    );
  });
});

// ---- listProjectDocuments — uploader filter ----

describe("listProjectDocuments — uploader filter", () => {
  it("sends the chosen uploader as uploader_id", async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 1, per_page: 25 }));

    await listProjectDocuments(PROJECT_ID, { uploaderId: UPLOADER_ID, page: 1 });

    const [url] = mockFetch().mock.calls[0] as [string];
    const query = new URL(url).searchParams;
    expect(query.get("uploader_id")).toBe(UPLOADER_ID);
    expect(query.get("page")).toBe("1");
  });

  it("omits uploader_id when no uploader is chosen", async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 1, per_page: 25 }));

    await listProjectDocuments(PROJECT_ID, { page: 1 });

    const [url] = mockFetch().mock.calls[0] as [string];
    expect(new URL(url).searchParams.has("uploader_id")).toBe(false);
  });
});
