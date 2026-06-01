/**
 * Tests for project-photos API wrapper.
 *
 * Covers:
 * - listProjectPhotos: snake→camelCase mapping, pagination query params
 * - buildHttpError: status + body propagation
 * - Network error handling
 *
 * Pattern mirrors src/__tests__/lib/api/projects-server.test.ts:
 *   global.fetch = vi.fn() in beforeEach, read via (global.fetch as ...).mock.calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Module mocks (hoisted before imports by Vitest) ----

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

// Static imports — vi.mock hoisting ensures mocks are active at import time.
import { listProjectPhotos, updateProjectPhoto, deleteProjectPhoto } from "../project-photos";

// ---- Helpers ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const PHOTO_ID = "22222222-2222-2222-2222-222222222222";

// Convenience alias — mirrors projects-server.test.ts pattern.
function mockFetch() {
  return global.fetch as ReturnType<typeof vi.fn>;
}

function makeRawPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO_ID,
    project_id: PROJECT_ID,
    filename: "photo.jpg",
    content_type: "image/jpeg",
    size_bytes: 102400,
    caption: "Test caption",
    captured_at: "2024-06-15T10:00:00Z",
    uploaded_at: "2024-06-16T08:00:00Z",
    uploader_id: "33333333-3333-3333-3333-333333333333",
    thumbnail_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/thumbnail`,
    original_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/original`,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: unknown = { error: "SOME_ERROR" }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---- Setup ----

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  // clearAllMocks resets call counts/history but preserves mock implementations
  // (vi.resetAllMocks would wipe sessionAuthHeader's mockResolvedValue).
  vi.clearAllMocks();
});

// ── listProjectPhotos ─────────────────────────────────────────────────────────

describe("listProjectPhotos — snake→camelCase mapping", () => {
  it("maps all snake_case fields to camelCase", async () => {
    const raw = makeRawPhoto();
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [raw], total: 1, page: 1, per_page: 20 })
    );

    const result = await listProjectPhotos(PROJECT_ID);

    expect(result.perPage).toBe(20);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    const photo = result.items[0];
    expect(photo.id).toBe(PHOTO_ID);
    expect(photo.projectId).toBe(PROJECT_ID);
    expect(photo.filename).toBe("photo.jpg");
    expect(photo.contentType).toBe("image/jpeg");
    expect(photo.sizeBytes).toBe(102400);
    expect(photo.caption).toBe("Test caption");
    expect(photo.capturedAt).toBe("2024-06-15T10:00:00Z");
    expect(photo.uploadedAt).toBe("2024-06-16T08:00:00Z");
    expect(photo.uploaderId).toBe("33333333-3333-3333-3333-333333333333");
    expect(photo.thumbnailUrl).toBe(
      `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/thumbnail`
    );
    expect(photo.originalUrl).toBe(
      `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/original`
    );
  });

  it("handles null caption correctly", async () => {
    const raw = makeRawPhoto({ caption: null });
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [raw], total: 1, page: 1, per_page: 20 })
    );

    const result = await listProjectPhotos(PROJECT_ID);
    expect(result.items[0].caption).toBeNull();
  });

  it("maps multiple items", async () => {
    const items = [makeRawPhoto({ id: "aa" }), makeRawPhoto({ id: "bb" })];
    mockFetch().mockResolvedValue(
      jsonResponse({ items, total: 2, page: 1, per_page: 20 })
    );

    const result = await listProjectPhotos(PROJECT_ID);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("aa");
    expect(result.items[1].id).toBe("bb");
  });

  it("returns empty items array when there are no photos", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 1, per_page: 20 })
    );

    const result = await listProjectPhotos(PROJECT_ID);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("listProjectPhotos — query params", () => {
  it("sends no query string when no params given", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 1, per_page: 20 })
    );

    await listProjectPhotos(PROJECT_ID);

    const [url] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://api.test/api/v1/projects/${PROJECT_ID}/photos`
    );
  });

  it("appends page and per_page query params when provided", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 2, per_page: 10 })
    );

    await listProjectPhotos(PROJECT_ID, { page: 2, perPage: 10 });

    const [url] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(url).toContain("page=2");
    expect(url).toContain("per_page=10");
  });

  it("uses cache: no-store and Content-Type application/json", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 1, per_page: 20 })
    );

    await listProjectPhotos(PROJECT_ID);

    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends Authorization header from sessionAuthHeader", async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 1, per_page: 20 })
    );

    await listProjectPhotos(PROJECT_ID);

    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });
});

describe("listProjectPhotos — error handling", () => {
  it("throws with HTTP status when response is not ok (403)", async () => {
    mockFetch().mockResolvedValue(errorResponse(403, { error: "FORBIDDEN" }));

    await expect(listProjectPhotos(PROJECT_ID)).rejects.toThrow("Failed to list photos (HTTP 403)");
  });

  it("attaches status + body to the thrown error (404)", async () => {
    mockFetch().mockResolvedValue(
      errorResponse(404, { error: "NOT_FOUND", message: "Project not found" })
    );

    let caughtErr: unknown;
    try {
      await listProjectPhotos(PROJECT_ID);
    } catch (err) {
      caughtErr = err;
    }

    const e = caughtErr as { status: number; body: { error: string } };
    expect(e.status).toBe(404);
    expect(e.body?.error).toBe("NOT_FOUND");
  });

  it("sets body to null when response is not JSON", async () => {
    mockFetch().mockResolvedValue(new Response("not-json", { status: 500 }));

    let caughtErr: unknown;
    try {
      await listProjectPhotos(PROJECT_ID);
    } catch (err) {
      caughtErr = err;
    }

    const e = caughtErr as { body: null };
    expect(e.body).toBeNull();
  });

  it("wraps network errors with a descriptive message", async () => {
    mockFetch().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(listProjectPhotos(PROJECT_ID)).rejects.toThrow(
      "Network error listing photos"
    );
  });
});

// ── updateProjectPhoto ────────────────────────────────────────────────────────

describe("updateProjectPhoto — success", () => {
  it("sends PATCH with snake_case body and maps response to camelCase", async () => {
    const raw = makeRawPhoto({ caption: "Updated caption" });
    mockFetch().mockResolvedValue(jsonResponse(raw));

    const result = await updateProjectPhoto(PROJECT_ID, PHOTO_ID, {
      caption: "Updated caption",
      capturedAt: "2024-06-20",
    });

    const [url, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/projects/${PROJECT_ID}/photos/${PHOTO_ID}`);
    expect(init.method).toBe("PATCH");

    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody.caption).toBe("Updated caption");
    expect(sentBody.captured_at).toBe("2024-06-20");

    expect(result.caption).toBe("Updated caption");
    expect(result.projectId).toBe(PROJECT_ID);
  });

  it("only sends caption when capturedAt is not provided", async () => {
    mockFetch().mockResolvedValue(jsonResponse(makeRawPhoto()));

    await updateProjectPhoto(PROJECT_ID, PHOTO_ID, { caption: "Only caption" });

    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody.caption).toBe("Only caption");
    expect(sentBody.captured_at).toBeUndefined();
  });
});

describe("updateProjectPhoto — error handling", () => {
  it("throws buildHttpError on non-2xx", async () => {
    mockFetch().mockResolvedValue(errorResponse(403, { error: "FORBIDDEN" }));

    await expect(
      updateProjectPhoto(PROJECT_ID, PHOTO_ID, { caption: "x" })
    ).rejects.toThrow("Failed to update photo (HTTP 403)");
  });

  it("wraps network error", async () => {
    mockFetch().mockRejectedValue(new TypeError("network failure"));

    await expect(
      updateProjectPhoto(PROJECT_ID, PHOTO_ID, { caption: "x" })
    ).rejects.toThrow("Network error updating photo");
  });
});

// ── deleteProjectPhoto ────────────────────────────────────────────────────────

describe("deleteProjectPhoto — success", () => {
  it("sends DELETE and resolves on 204", async () => {
    mockFetch().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      deleteProjectPhoto(PROJECT_ID, PHOTO_ID)
    ).resolves.toBeUndefined();

    const [url, init] = mockFetch().mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/projects/${PROJECT_ID}/photos/${PHOTO_ID}`);
    expect(init.method).toBe("DELETE");
  });
});

describe("deleteProjectPhoto — error handling", () => {
  it("throws buildHttpError on 403", async () => {
    mockFetch().mockResolvedValue(errorResponse(403, { error: "FORBIDDEN" }));

    await expect(
      deleteProjectPhoto(PROJECT_ID, PHOTO_ID)
    ).rejects.toThrow("Failed to delete photo (HTTP 403)");
  });

  it("throws buildHttpError on 404", async () => {
    mockFetch().mockResolvedValue(errorResponse(404, { error: "NOT_FOUND" }));

    await expect(
      deleteProjectPhoto(PROJECT_ID, PHOTO_ID)
    ).rejects.toThrow("Failed to delete photo (HTTP 404)");
  });

  it("wraps network error", async () => {
    mockFetch().mockRejectedValue(new TypeError("connection refused"));

    await expect(
      deleteProjectPhoto(PROJECT_ID, PHOTO_ID)
    ).rejects.toThrow("Network error deleting photo");
  });
});
