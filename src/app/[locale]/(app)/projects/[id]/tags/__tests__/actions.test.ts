/**
 * Tests for tags server actions (create, update, delete).
 * Mirrors notes/__tests__/actions.test.ts pattern.
 * Covers:
 * - Input validation (UUID, hex color, name trimming)
 * - Error mapping via classifyBackendError (400/409 → expected string)
 * - Happy path for create, update, delete
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must be before imports) ----

vi.mock("@/lib/api/tags", () => ({
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

// ---- Imports after mocks ----

const { createTagAction, updateTagAction, deleteTagAction } = await import(
  "../actions"
);
const { createTag, updateTag, deleteTag } = await import("@/lib/api/tags");
const mockCreate = vi.mocked(createTag);
const mockUpdate = vi.mocked(updateTag);
const mockDelete = vi.mocked(deleteTag);

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

function makeTag(id = TAG_ID, name = "Excavation") {
  return {
    id,
    project_id: PROJECT_ID,
    name,
    color: "#ef4444",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const TAG_ID = "22222222-2222-2222-2222-222222222222";
const BAD_ID = "not-a-uuid";

// ---- createTagAction ----

describe("createTagAction — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-UUID projectId", async () => {
    const result = await createTagAction(BAD_ID, "Excavation", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await createTagAction("", "Excavation", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects empty tag name", async () => {
    const result = await createTagAction(PROJECT_ID, "", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects tag name with only whitespace", async () => {
    const result = await createTagAction(PROJECT_ID, "   ", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid hex color (not starting with #)", async () => {
    const result = await createTagAction(PROJECT_ID, "Excavation", "ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid hex color (too few digits)", async () => {
    const result = await createTagAction(PROJECT_ID, "Excavation", "#ef44");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid hex color (non-hex digits)", async () => {
    const result = await createTagAction(PROJECT_ID, "Excavation", "#GGGGGG");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts uppercase hex color", async () => {
    const tag = makeTag();
    mockCreate.mockResolvedValueOnce(tag);
    const result = await createTagAction(PROJECT_ID, "Excavation", "#EF4444");
    expect(result).toEqual({ success: true, tag });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("accepts lowercase hex color", async () => {
    const tag = makeTag();
    mockCreate.mockResolvedValueOnce(tag);
    const result = await createTagAction(PROJECT_ID, "Excavation", "#ef4444");
    expect(result).toEqual({ success: true, tag });
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe("createTagAction — trimming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trims whitespace from tag name before sending", async () => {
    const tag = makeTag(TAG_ID, "Excavation");
    mockCreate.mockResolvedValueOnce(tag);
    await createTagAction(PROJECT_ID, "  Excavation  ", "#ef4444");

    expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
      name: "Excavation",
      color: "#ef4444",
    });
  });

  it("does not trim name on server if client fails to trim (defensive)", async () => {
    const tag = makeTag();
    mockCreate.mockResolvedValueOnce(tag);
    // Even if we pass untrimed, the action trims it
    await createTagAction(PROJECT_ID, "\t My Tag \n", "#ef4444");

    expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
      name: "My Tag",
      color: "#ef4444",
    });
  });
});

describe("createTagAction — error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400 → validation", async () => {
    mockCreate.mockRejectedValueOnce(httpError(400));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("422 → validation", async () => {
    mockCreate.mockRejectedValueOnce(httpError(422));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("403 → forbidden", async () => {
    mockCreate.mockRejectedValueOnce(httpError(403));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockCreate.mockRejectedValueOnce(httpError(404));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("409 → duplicate", async () => {
    mockCreate.mockRejectedValueOnce(httpError(409));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "duplicate" });
  });

  it("429 → rateLimited", async () => {
    mockCreate.mockRejectedValueOnce(httpError(429));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockCreate.mockRejectedValueOnce(httpError(500));
    const result = await createTagAction(PROJECT_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "generic" });
  });
});

describe("createTagAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createTag and returns success with tag", async () => {
    const tag = makeTag();
    mockCreate.mockResolvedValueOnce(tag);
    const result = await createTagAction(PROJECT_ID, "Excavation", "#ef4444");

    expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
      name: "Excavation",
      color: "#ef4444",
    });
    expect(result).toEqual({ success: true, tag });
  });
});

// ---- updateTagAction ----

describe("updateTagAction — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-UUID projectId", async () => {
    const result = await updateTagAction(BAD_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-UUID tagId", async () => {
    const result = await updateTagAction(PROJECT_ID, BAD_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects empty tag name", async () => {
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects tag name with only whitespace", async () => {
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "  ", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid hex color", async () => {
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#GGGGGG");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updateTagAction — error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400 → validation", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(400));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("403 → forbidden", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(403));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(404));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("409 → duplicate", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(409));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "duplicate" });
  });

  it("429 → rateLimited", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(429));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(500));
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "Tag", "#ef4444");
    expect(result).toEqual({ success: false, error: "generic" });
  });
});

describe("updateTagAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateTag with trimmed name and color", async () => {
    const tag = makeTag(TAG_ID, "Updated");
    mockUpdate.mockResolvedValueOnce(tag);
    const result = await updateTagAction(
      PROJECT_ID,
      TAG_ID,
      "  Updated  ",
      "#3b82f6"
    );

    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, TAG_ID, {
      name: "Updated",
      color: "#3b82f6",
    });
    expect(result).toEqual({ success: true, tag });
  });

  it("returns updated tag on success", async () => {
    const tag = makeTag(TAG_ID, "New Name");
    mockUpdate.mockResolvedValueOnce(tag);
    const result = await updateTagAction(PROJECT_ID, TAG_ID, "New Name", "#3b82f6");

    expect(result).toEqual({ success: true, tag });
  });
});

// ---- deleteTagAction ----

describe("deleteTagAction — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-UUID projectId", async () => {
    const result = await deleteTagAction(BAD_ID, TAG_ID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects non-UUID tagId", async () => {
    const result = await deleteTagAction(PROJECT_ID, BAD_ID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await deleteTagAction("", TAG_ID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects empty tagId", async () => {
    const result = await deleteTagAction(PROJECT_ID, "");
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("deleteTagAction — error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("403 → forbidden", async () => {
    mockDelete.mockRejectedValueOnce(httpError(403));
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockDelete.mockRejectedValueOnce(httpError(404));
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockDelete.mockRejectedValueOnce(httpError(429));
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockDelete.mockRejectedValueOnce(httpError(500));
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);
    expect(result).toEqual({ success: false, error: "generic" });
  });
});

describe("deleteTagAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteTag and returns success", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);

    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, TAG_ID);
    expect(result).toEqual({ success: true });
  });

  it("handles void return from deleteTag", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const result = await deleteTagAction(PROJECT_ID, TAG_ID);

    expect(result.success).toBe(true);
  });
});
