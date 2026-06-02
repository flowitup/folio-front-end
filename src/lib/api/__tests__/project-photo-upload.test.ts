/**
 * Tests for uploadProjectPhoto — client-direct multipart POST to the BE.
 *
 * Covers:
 * - 201 response: maps snake→camel correctly
 * - 4xx non-401: throws with .status and .body
 * - 401 → refresh succeeds → retries and returns mapped photo
 * - 401 → refresh fails → throws with status 401
 * - Network error (fetch throws): propagates as-is
 * - FormData fields: caption/captured_at omitted when empty, included when set
 * - CSRF header included when token present, omitted when null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks (must be before imports) ----

vi.mock("../http", () => ({
  getCsrfToken: vi.fn(),
}));

vi.mock("../refresh", () => ({
  refreshAccessTokenViaCookie: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

// ---- Imports after mocks ----

import { uploadProjectPhoto } from "../project-photo-blob";
import { getCsrfToken } from "../http";
import { refreshAccessTokenViaCookie } from "../refresh";

// ---- Constants ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const PHOTO_ID = "22222222-2222-2222-2222-222222222222";
const UPLOADER_ID = "33333333-3333-3333-3333-333333333333";

// ---- Helpers ----

function makeFile(name = "photo.jpg", type = "image/jpeg", size = 4096): File {
  return new File([new Uint8Array(size)], name, { type });
}

function rawPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO_ID,
    project_id: PROJECT_ID,
    filename: "photo.jpg",
    content_type: "image/jpeg",
    size_bytes: 4096,
    caption: null as string | null,
    captured_at: "2024-06-15T10:00:00Z",
    uploaded_at: "2024-06-16T08:00:00Z",
    uploader_id: UPLOADER_ID,
    thumbnail_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/thumbnail`,
    original_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/original`,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---- Setup ----

beforeEach(() => {
  vi.mocked(getCsrfToken).mockReturnValue(null);
  vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(false);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("uploadProjectPhoto — success (201)", () => {
  it("maps snake_case response to camelCase ProjectPhoto", async () => {
    const raw = rawPhoto({ caption: "Sunny day" });
    vi.mocked(fetch).mockResolvedValue(jsonResponse(raw, 201));

    const photo = await uploadProjectPhoto(PROJECT_ID, makeFile(), {
      caption: "Sunny day",
      capturedAt: "2024-06-15",
    });

    expect(photo.id).toBe(PHOTO_ID);
    expect(photo.projectId).toBe(PROJECT_ID);
    expect(photo.filename).toBe("photo.jpg");
    expect(photo.contentType).toBe("image/jpeg");
    expect(photo.sizeBytes).toBe(4096);
    expect(photo.caption).toBe("Sunny day");
    expect(photo.capturedAt).toBe("2024-06-15T10:00:00Z");
    expect(photo.uploadedAt).toBe("2024-06-16T08:00:00Z");
    expect(photo.uploaderId).toBe(UPLOADER_ID);
    expect(photo.thumbnailUrl).toContain("thumbnail");
    expect(photo.originalUrl).toContain("original");
  });

  it("maps photo with null caption correctly", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    const photo = await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    expect(photo.caption).toBeNull();
  });

  it("POSTs to the correct BE endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`http://api.test/api/v1/projects/${PROJECT_ID}/photos`);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("sends credentials:include", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("does not set Content-Type (lets browser set multipart boundary)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["content-type"]).toBeUndefined();
  });
});

// ── CSRF header ───────────────────────────────────────────────────────────────

describe("uploadProjectPhoto — CSRF header", () => {
  it("includes X-CSRF-TOKEN when token is present", async () => {
    vi.mocked(getCsrfToken).mockReturnValue("csrf-abc");
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRF-TOKEN"]).toBe("csrf-abc");
  });

  it("omits X-CSRF-TOKEN when token is null", async () => {
    vi.mocked(getCsrfToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRF-TOKEN"]).toBeUndefined();
  });
});

// ── FormData field handling ───────────────────────────────────────────────────

describe("uploadProjectPhoto — FormData fields", () => {
  it("appends caption and captured_at when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {
      caption: "My caption",
      capturedAt: "2024-06-15",
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("caption")).toBe("My caption");
    expect(fd.get("captured_at")).toBe("2024-06-15");
  });

  it("omits caption when empty string", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), { caption: "" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("caption")).toBeNull();
  });

  it("omits caption when whitespace-only", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), { caption: "   " });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("caption")).toBeNull();
  });

  it("omits captured_at when not provided", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("captured_at")).toBeNull();
  });

  it("encodes projectId in URL", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rawPhoto(), 201));

    await uploadProjectPhoto("proj/special&id", makeFile(), {});

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url as string).toContain("proj%2Fspecial%26id");
  });
});

// ── 401 → refresh + retry ─────────────────────────────────────────────────────

describe("uploadProjectPhoto — 401 refresh retry", () => {
  it("retries once after 401 when refresh succeeds", async () => {
    vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(rawPhoto(), 201));

    const photo = await uploadProjectPhoto(PROJECT_ID, makeFile(), {});

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refreshAccessTokenViaCookie).toHaveBeenCalledTimes(1);
    expect(photo.id).toBe(PHOTO_ID);
  });

  it("throws with status 401 when refresh fails", async () => {
    vi.mocked(refreshAccessTokenViaCookie).mockResolvedValue(false);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({ status: 401 });

    // Refresh was attempted but failed — no second fetch call
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ── 4xx / 5xx errors ─────────────────────────────────────────────────────────

describe("uploadProjectPhoto — non-2xx errors", () => {
  it("throws error with .status and .body on 400 JSON response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "FILE_TOO_LARGE" }, 400)
    );

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({
      status: 400,
      body: { error: "FILE_TOO_LARGE" },
    });
  });

  it("throws error with .status 413", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 413 }));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({ status: 413 });
  });

  it("throws error with .status 415 and body.error UNSUPPORTED_TYPE", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "UNSUPPORTED_TYPE" }, 415)
    );

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({
      status: 415,
      body: { error: "UNSUPPORTED_TYPE" },
    });
  });

  it("throws error with .status 403", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({ status: 403 });
  });

  it("throws error with .status 429", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({ status: 429 });
  });

  it("throws error with .status 500 and null body when response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("internal error", { status: 500 }));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({ status: 500, body: null });
  });

  it("throws error with .status 422 and body.error INVALID_IMAGE", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "INVALID_IMAGE" }, 422)
    );

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toMatchObject({
      status: 422,
      body: { error: "INVALID_IMAGE" },
    });
  });
});

// ── Network error ─────────────────────────────────────────────────────────────

describe("uploadProjectPhoto — network errors", () => {
  it("propagates fetch TypeError to caller", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      uploadProjectPhoto(PROJECT_ID, makeFile(), {})
    ).rejects.toThrow("Failed to fetch");
  });
});
