/**
 * Tests for photos server actions.
 *
 * Covers:
 * - uploadPhotoAction: validation, success, classified errors (FILE_TOO_LARGE,
 *   UNSUPPORTED_TYPE, INVALID_IMAGE, 403 forbidden, 429 rate-limited)
 * - updatePhotoAction: validation, success, error mapping
 * - deletePhotoAction: validation, success, error mapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Module mocks (must be before imports) ----

// next/navigation is used by classifyBackendError (redirect on 401)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

// next/cache: revalidatePath is a no-op in tests
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Auth header — return a valid token so auth guard passes
vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

// API wrappers used by actions
vi.mock("@/lib/api/project-photos", () => ({
  listProjectPhotos: vi.fn(),
  updateProjectPhoto: vi.fn(),
  deleteProjectPhoto: vi.fn(),
}));

// ---- Imports after mocks ----

const { uploadPhotoAction, updatePhotoAction, deletePhotoAction, loadMorePhotosAction } = await import("../actions");

const { listProjectPhotos, updateProjectPhoto, deleteProjectPhoto } = await import("@/lib/api/project-photos");
const mockListPhotos = vi.mocked(listProjectPhotos);
const mockUpdatePhoto = vi.mocked(updateProjectPhoto);
const mockDeletePhoto = vi.mocked(deleteProjectPhoto);

const { revalidatePath } = await import("next/cache");
const mockRevalidate = vi.mocked(revalidatePath);

// ---- Constants ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const PHOTO_ID = "22222222-2222-2222-2222-222222222222";
const BAD_ID = "not-a-uuid";

// ---- Helpers ----

function makeFile(name = "photo.jpg", type = "image/jpeg", size = 102400) {
  const arr = new Uint8Array(size);
  return new File([arr], name, { type });
}

function makeFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData();
  fd.append("file", overrides.file instanceof File ? overrides.file : makeFile());
  if (overrides.caption) fd.append("caption", overrides.caption as string);
  if (overrides.captured_at) fd.append("captured_at", overrides.captured_at as string);
  return fd;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeRawPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO_ID,
    project_id: PROJECT_ID,
    filename: "photo.jpg",
    content_type: "image/jpeg",
    size_bytes: 102400,
    caption: null,
    captured_at: "2024-06-15T10:00:00Z",
    uploaded_at: "2024-06-16T08:00:00Z",
    uploader_id: "33333333-3333-3333-3333-333333333333",
    thumbnail_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/thumbnail`,
    original_url: `/api/v1/projects/${PROJECT_ID}/photos/${PHOTO_ID}/original`,
    ...overrides,
  };
}

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

// ── uploadPhotoAction ─────────────────────────────────────────────────────────

describe("uploadPhotoAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await uploadPhotoAction(BAD_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });

  it("rejects empty projectId", async () => {
    const result = await uploadPhotoAction("", makeFormData());
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });

  it("rejects missing file in FormData", async () => {
    const fd = new FormData();
    // No file appended
    const result = await uploadPhotoAction(PROJECT_ID, fd);
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });

  it("rejects zero-byte file", async () => {
    const fd = new FormData();
    fd.append("file", new File([], "empty.jpg", { type: "image/jpeg" }));
    const result = await uploadPhotoAction(PROJECT_ID, fd);
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });
});

describe("uploadPhotoAction — success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true with mapped photo on 201", async () => {
    const raw = makeRawPhoto({ caption: "Sunny day" });
    vi.mocked(fetch).mockResolvedValue(jsonResponse(raw, 201));

    const fd = makeFormData({ caption: "Sunny day", captured_at: "2024-06-15" });
    const result = await uploadPhotoAction(PROJECT_ID, fd);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(PHOTO_ID);
      expect(result.data.projectId).toBe(PROJECT_ID);
      expect(result.data.caption).toBe("Sunny day");
      expect(result.data.contentType).toBe("image/jpeg");
    }
  });

  it("calls revalidatePath after successful upload", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(makeRawPhoto(), 201));

    await uploadPhotoAction(PROJECT_ID, makeFormData());

    expect(mockRevalidate).toHaveBeenCalledWith(
      expect.stringContaining(PROJECT_ID),
      "page"
    );
  });

  it("sends POST to the correct BE endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(makeRawPhoto(), 201));

    await uploadPhotoAction(PROJECT_ID, makeFormData());

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `http://api.test/api/v1/projects/${PROJECT_ID}/photos`
    );
    expect((init as RequestInit).method).toBe("POST");
  });

  it("trims whitespace-only caption and omits it from the BE request", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(makeRawPhoto(), 201));

    const fd = new FormData();
    fd.append("file", makeFile());
    fd.append("caption", "   ");
    await uploadPhotoAction(PROJECT_ID, fd);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    // The BE FormData should not have caption when it's only whitespace
    const beBody = (init as RequestInit).body as FormData;
    expect(beBody.get("caption")).toBeNull();
  });

  it("returns ok:false with network error on fetch throw", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("failed to fetch"));

    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("network");
    }
  });
});

describe("uploadPhotoAction — classified errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("FILE_TOO_LARGE BE error code → oversize", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "FILE_TOO_LARGE" }, 400)
    );
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "oversize" });
  });

  it("HTTP 413 → oversize", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 413 }));
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "oversize" });
  });

  it("UNSUPPORTED_TYPE BE error code → unsupported", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "UNSUPPORTED_TYPE" }, 415)
    );
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "unsupported" });
  });

  it("HTTP 415 → unsupported", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 415 }));
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "unsupported" });
  });

  it("INVALID_IMAGE BE error code → invalidImage", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "INVALID_IMAGE" }, 422)
    );
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "invalidImage" });
  });

  it("HTTP 403 → forbidden", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("HTTP 429 → rateLimited", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "rateLimited" });
  });

  it("HTTP 500 → server", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await uploadPhotoAction(PROJECT_ID, makeFormData());
    expect(result).toMatchObject({ ok: false, error: "server" });
  });
});

// ── updatePhotoAction ─────────────────────────────────────────────────────────

describe("updatePhotoAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await updatePhotoAction(BAD_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockUpdatePhoto).not.toHaveBeenCalled();
  });

  it("rejects non-UUID photoId", async () => {
    const result = await updatePhotoAction(PROJECT_ID, BAD_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockUpdatePhoto).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await updatePhotoAction("", PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });
});

describe("updatePhotoAction — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with updated photo data", async () => {
    const updated = {
      id: PHOTO_ID,
      projectId: PROJECT_ID,
      filename: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 102400,
      caption: "New caption",
      capturedAt: "2024-06-15T10:00:00Z",
      uploadedAt: "2024-06-16T08:00:00Z",
      uploaderId: "33333333-3333-3333-3333-333333333333",
      thumbnailUrl: "/thumb",
      originalUrl: "/original",
    };
    mockUpdatePhoto.mockResolvedValueOnce(updated);

    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, {
      caption: "New caption",
    });

    expect(result).toEqual({ ok: true, data: updated });
    expect(mockUpdatePhoto).toHaveBeenCalledWith(PROJECT_ID, PHOTO_ID, {
      caption: "New caption",
    });
  });

  it("calls revalidatePath after update", async () => {
    mockUpdatePhoto.mockResolvedValueOnce({
      id: PHOTO_ID,
      projectId: PROJECT_ID,
      filename: "p.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1,
      caption: null,
      capturedAt: "2024-01-01T00:00:00Z",
      uploadedAt: "2024-01-01T00:00:00Z",
      uploaderId: "u1",
      thumbnailUrl: "/t",
      originalUrl: "/o",
    });

    await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(mockRevalidate).toHaveBeenCalledWith(
      expect.stringContaining(PROJECT_ID),
      "page"
    );
  });
});

describe("updatePhotoAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("FILE_TOO_LARGE body error → oversize", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(
      httpError(400, { error: "FILE_TOO_LARGE" })
    );
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "oversize" });
  });

  it("403 → forbidden", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(httpError(403));
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(httpError(404));
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(httpError(429));
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "rateLimited" });
  });

  it("500 → server", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(httpError(500));
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "server" });
  });

  it("INVALID_IMAGE body error → invalidImage", async () => {
    mockUpdatePhoto.mockRejectedValueOnce(
      httpError(422, { error: "INVALID_IMAGE" })
    );
    const result = await updatePhotoAction(PROJECT_ID, PHOTO_ID, { caption: "x" });
    expect(result).toMatchObject({ ok: false, error: "invalidImage" });
  });
});

// ── deletePhotoAction ─────────────────────────────────────────────────────────

describe("deletePhotoAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await deletePhotoAction(BAD_ID, PHOTO_ID);
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockDeletePhoto).not.toHaveBeenCalled();
  });

  it("rejects non-UUID photoId", async () => {
    const result = await deletePhotoAction(PROJECT_ID, BAD_ID);
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockDeletePhoto).not.toHaveBeenCalled();
  });
});

describe("deletePhotoAction — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true on successful delete", async () => {
    mockDeletePhoto.mockResolvedValueOnce(undefined);

    const result = await deletePhotoAction(PROJECT_ID, PHOTO_ID);

    expect(result).toEqual({ ok: true });
    expect(mockDeletePhoto).toHaveBeenCalledWith(PROJECT_ID, PHOTO_ID);
  });

  it("calls revalidatePath after delete", async () => {
    mockDeletePhoto.mockResolvedValueOnce(undefined);

    await deletePhotoAction(PROJECT_ID, PHOTO_ID);

    expect(mockRevalidate).toHaveBeenCalledWith(
      expect.stringContaining(PROJECT_ID),
      "page"
    );
  });
});

describe("deletePhotoAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 → forbidden", async () => {
    mockDeletePhoto.mockRejectedValueOnce(httpError(403));
    const result = await deletePhotoAction(PROJECT_ID, PHOTO_ID);
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockDeletePhoto.mockRejectedValueOnce(httpError(404));
    const result = await deletePhotoAction(PROJECT_ID, PHOTO_ID);
    expect(result).toMatchObject({ ok: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockDeletePhoto.mockRejectedValueOnce(httpError(429));
    const result = await deletePhotoAction(PROJECT_ID, PHOTO_ID);
    expect(result).toMatchObject({ ok: false, error: "rateLimited" });
  });

  it("500 → server", async () => {
    mockDeletePhoto.mockRejectedValueOnce(httpError(500));
    const result = await deletePhotoAction(PROJECT_ID, PHOTO_ID);
    expect(result).toMatchObject({ ok: false, error: "server" });
  });
});

// ── loadMorePhotosAction ──────────────────────────────────────────────────────

describe("loadMorePhotosAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await loadMorePhotosAction(BAD_ID, 2);
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockListPhotos).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await loadMorePhotosAction("", 2);
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });

  it("rejects page < 2 (page 1 is served by SSR)", async () => {
    const result = await loadMorePhotosAction(PROJECT_ID, 1);
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(mockListPhotos).not.toHaveBeenCalled();
  });

  it("rejects non-integer page", async () => {
    const result = await loadMorePhotosAction(PROJECT_ID, 2.5);
    expect(result).toMatchObject({ ok: false, error: "validation" });
  });
});

describe("loadMorePhotosAction — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with PhotoListResult on page 2", async () => {
    const listResult = {
      items: [
        {
          id: PHOTO_ID,
          projectId: PROJECT_ID,
          filename: "p.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1024,
          caption: null,
          capturedAt: "2024-06-15T10:00:00Z",
          uploadedAt: "2024-06-16T08:00:00Z",
          uploaderId: "u1",
          thumbnailUrl: "/thumb",
          originalUrl: "/original",
        },
      ],
      total: 51,
      page: 2,
      perPage: 50,
    };
    mockListPhotos.mockResolvedValueOnce(listResult);

    const result = await loadMorePhotosAction(PROJECT_ID, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.page).toBe(2);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(51);
    }
    expect(mockListPhotos).toHaveBeenCalledWith(PROJECT_ID, { page: 2, perPage: 50 });
  });
});

describe("loadMorePhotosAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 → forbidden", async () => {
    mockListPhotos.mockRejectedValueOnce(httpError(403));
    const result = await loadMorePhotosAction(PROJECT_ID, 2);
    expect(result).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("500 → server", async () => {
    mockListPhotos.mockRejectedValueOnce(httpError(500));
    const result = await loadMorePhotosAction(PROJECT_ID, 2);
    expect(result).toMatchObject({ ok: false, error: "server" });
  });
});
