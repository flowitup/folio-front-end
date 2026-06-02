/**
 * Tests for photos server actions.
 *
 * Covers:
 * - updatePhotoAction: validation, success, error mapping
 * - deletePhotoAction: validation, success, error mapping
 * - loadMorePhotosAction: validation, success, error mapping
 *
 * Note: uploadPhotoAction has been removed — photo upload is now done
 * client-direct via uploadProjectPhoto in project-photo-blob.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { updatePhotoAction, deletePhotoAction, loadMorePhotosAction } = await import("../actions");

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
