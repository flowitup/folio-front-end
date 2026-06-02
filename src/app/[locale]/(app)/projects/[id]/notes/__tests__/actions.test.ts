/**
 * Tests for notes server actions (journal model).
 * Mirrors admin/users/actions.test.ts pattern.
 *
 * Covers:
 * - Input validation (UUID checks, required fields, category validation)
 * - Error mapping: 400, 403, 404, 429, 500
 * - Happy path for each action
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must be before imports) ----

vi.mock("@/lib/api/notes", () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

// next/navigation is used by classifyBackendError (redirect on 401)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));

// Session guard mocked as authenticated; the unauthenticated branch is trivial.
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "11111111-1111-1111-1111-111111111111" },
    accessToken: "test-token",
    expiresAt: Date.now() + 60_000,
  }),
}));

// ---- Imports after mocks ----

const {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} = await import("../actions");

const { createNote, updateNote, deleteNote } = await import("@/lib/api/notes");
const mockCreate = vi.mocked(createNote);
const mockUpdate = vi.mocked(updateNote);
const mockDelete = vi.mocked(deleteNote);

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

function makeNote(id = NOTE_ID) {
  return {
    id,
    project_id: PROJECT_ID,
    created_by: "user-1",
    title: "Test note",
    description: null,
    category: "general" as const,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID    = "22222222-2222-2222-2222-222222222222";
const BAD_ID     = "not-a-uuid";

const VALID_CREATE = { title: "My note" };

// ---- createNoteAction — input validation ----

describe("createNoteAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await createNoteAction(BAD_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects empty title", async () => {
    const result = await createNoteAction(PROJECT_ID, { title: "  " });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const result = await createNoteAction(PROJECT_ID, { title: "" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid category string", async () => {
    const result = await createNoteAction(PROJECT_ID, {
      title: "ok",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: "unknown" as any,
    });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts valid category", async () => {
    mockCreate.mockResolvedValueOnce(makeNote());
    const result = await createNoteAction(PROJECT_ID, { title: "ok", category: "call" });
    expect(result.success).toBe(true);
  });

  it("accepts note with no category (optional)", async () => {
    mockCreate.mockResolvedValueOnce(makeNote());
    const result = await createNoteAction(PROJECT_ID, { title: "ok" });
    expect(result.success).toBe(true);
  });
});

// ---- createNoteAction — error mapping ----

describe("createNoteAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400 → validation", async () => {
    mockCreate.mockRejectedValueOnce(httpError(400));
    const result = await createNoteAction(PROJECT_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("403 → forbidden", async () => {
    mockCreate.mockRejectedValueOnce(httpError(403));
    const result = await createNoteAction(PROJECT_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockCreate.mockRejectedValueOnce(httpError(404));
    const result = await createNoteAction(PROJECT_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockCreate.mockRejectedValueOnce(httpError(429));
    const result = await createNoteAction(PROJECT_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockCreate.mockRejectedValueOnce(httpError(500));
    const result = await createNoteAction(PROJECT_ID, VALID_CREATE);
    expect(result).toEqual({ success: false, error: "generic" });
  });
});

// ---- createNoteAction — happy path ----

describe("createNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trims title and calls createNote", async () => {
    const note = makeNote();
    mockCreate.mockResolvedValueOnce(note);
    const result = await createNoteAction(PROJECT_ID, { title: "  My note  " });
    expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, { title: "My note" });
    expect(result).toEqual({ success: true, note });
  });

  it("passes category through to createNote", async () => {
    const note = makeNote();
    mockCreate.mockResolvedValueOnce(note);
    await createNoteAction(PROJECT_ID, { title: "ok", category: "delivery" });
    expect(mockCreate).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ category: "delivery" })
    );
  });
});

// ---- updateNoteAction — input validation ----

describe("updateNoteAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await updateNoteAction(BAD_ID, NOTE_ID, { title: "x" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-UUID noteId", async () => {
    const result = await updateNoteAction(PROJECT_ID, BAD_ID, { title: "x" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid category in patch", async () => {
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: "bad-cat" as any,
    });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects title that becomes empty after trim", async () => {
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "   " });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("accepts a valid category in patch", async () => {
    mockUpdate.mockResolvedValueOnce(makeNote());
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { category: "decision" });
    expect(result.success).toBe(true);
  });
});

// ---- updateNoteAction — error mapping ----

describe("updateNoteAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 → forbidden", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(403));
    expect(await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "x" })).toEqual({
      success: false, error: "forbidden",
    });
  });

  it("404 → notFound", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(404));
    expect(await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "x" })).toEqual({
      success: false, error: "notFound",
    });
  });

  it("429 → rateLimited", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(429));
    expect(await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "x" })).toEqual({
      success: false, error: "rateLimited",
    });
  });

  it("500 → generic", async () => {
    mockUpdate.mockRejectedValueOnce(httpError(500));
    expect(await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "x" })).toEqual({
      success: false, error: "generic",
    });
  });
});

// ---- updateNoteAction — happy path ----

describe("updateNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNote with trimmed title and returns note", async () => {
    const note = makeNote();
    mockUpdate.mockResolvedValueOnce(note);
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "  New title  " });
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID, { title: "New title" });
    expect(result).toEqual({ success: true, note });
  });

  it("patch with only description is accepted", async () => {
    const note = makeNote();
    mockUpdate.mockResolvedValueOnce(note);
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { description: "details" });
    expect(result).toEqual({ success: true, note });
  });
});

// ---- deleteNoteAction — input validation ----

describe("deleteNoteAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await deleteNoteAction(BAD_ID, NOTE_ID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects non-UUID noteId", async () => {
    const result = await deleteNoteAction(PROJECT_ID, BAD_ID);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ---- deleteNoteAction — error mapping ----

describe("deleteNoteAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 → forbidden", async () => {
    mockDelete.mockRejectedValueOnce(httpError(403));
    expect(await deleteNoteAction(PROJECT_ID, NOTE_ID)).toEqual({
      success: false, error: "forbidden",
    });
  });

  it("404 → notFound", async () => {
    mockDelete.mockRejectedValueOnce(httpError(404));
    expect(await deleteNoteAction(PROJECT_ID, NOTE_ID)).toEqual({
      success: false, error: "notFound",
    });
  });

  it("500 → generic", async () => {
    mockDelete.mockRejectedValueOnce(httpError(500));
    expect(await deleteNoteAction(PROJECT_ID, NOTE_ID)).toEqual({
      success: false, error: "generic",
    });
  });
});

// ---- deleteNoteAction — happy path ----

describe("deleteNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls deleteNote and returns success", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const result = await deleteNoteAction(PROJECT_ID, NOTE_ID);
    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID);
    expect(result).toEqual({ success: true });
  });
});
