/**
 * Tests for notes server actions.
 * Mirrors admin/users/actions.test.ts pattern.
 *
 * Covers:
 * - Input validation (UUID checks, required fields, date format, empty title)
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

// ---- Imports after mocks ----

const {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  markNoteDoneAction,
  markNoteOpenAction,
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
    due_date: "2024-06-15",
    lead_time_minutes: 0 as const,
    status: "open" as const,
    fire_at: "2024-06-15T09:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID = "22222222-2222-2222-2222-222222222222";
const BAD_ID = "not-a-uuid";
const VALID_PAYLOAD = { title: "My note", due_date: "2024-06-15", lead_time_minutes: 0 as const };

// ---- createNoteAction ----

describe("createNoteAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await createNoteAction(BAD_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects empty title", async () => {
    const result = await createNoteAction(PROJECT_ID, { ...VALID_PAYLOAD, title: "  " });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const result = await createNoteAction(PROJECT_ID, { ...VALID_PAYLOAD, title: "" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed due_date", async () => {
    const result = await createNoteAction(PROJECT_ID, { ...VALID_PAYLOAD, due_date: "15-06-2024" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects missing due_date", async () => {
    const result = await createNoteAction(PROJECT_ID, { ...VALID_PAYLOAD, due_date: "" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("createNoteAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400 → validation", async () => {
    mockCreate.mockRejectedValueOnce(httpError(400));
    const result = await createNoteAction(PROJECT_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "validation" });
  });

  it("403 → forbidden", async () => {
    mockCreate.mockRejectedValueOnce(httpError(403));
    const result = await createNoteAction(PROJECT_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockCreate.mockRejectedValueOnce(httpError(404));
    const result = await createNoteAction(PROJECT_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockCreate.mockRejectedValueOnce(httpError(429));
    const result = await createNoteAction(PROJECT_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockCreate.mockRejectedValueOnce(httpError(500));
    const result = await createNoteAction(PROJECT_ID, VALID_PAYLOAD);
    expect(result).toEqual({ success: false, error: "generic" });
  });
});

describe("createNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trims title and calls createNote", async () => {
    const note = makeNote();
    mockCreate.mockResolvedValueOnce(note);
    const result = await createNoteAction(PROJECT_ID, { ...VALID_PAYLOAD, title: "  My note  " });
    expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
      ...VALID_PAYLOAD,
      title: "My note",
    });
    expect(result).toEqual({ success: true, note });
  });
});

// ---- updateNoteAction ----

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

  it("rejects malformed due_date in patch", async () => {
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { due_date: "bad-date" });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects title that becomes empty after trim", async () => {
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "   " });
    expect(result).toEqual({ success: false, error: "validation" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

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

describe("updateNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNote with trimmed title and returns note", async () => {
    const note = makeNote();
    mockUpdate.mockResolvedValueOnce(note);
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { title: "  New title  " });
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID, { title: "New title" });
    expect(result).toEqual({ success: true, note });
  });

  it("accepts valid YYYY-MM-DD due_date", async () => {
    const note = makeNote();
    mockUpdate.mockResolvedValueOnce(note);
    const result = await updateNoteAction(PROJECT_ID, NOTE_ID, { due_date: "2025-12-31" });
    expect(result).toEqual({ success: true, note });
  });
});

// ---- deleteNoteAction ----

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

describe("deleteNoteAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls deleteNote and returns success", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const result = await deleteNoteAction(PROJECT_ID, NOTE_ID);
    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID);
    expect(result).toEqual({ success: true });
  });
});

// ---- markNoteDoneAction / markNoteOpenAction ----

describe("markNoteDoneAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNoteAction with status: done", async () => {
    const note = { ...makeNote(), status: "done" as const };
    mockUpdate.mockResolvedValueOnce(note);
    const result = await markNoteDoneAction(PROJECT_ID, NOTE_ID);
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID, { status: "done" });
    expect(result).toEqual({ success: true, note });
  });

  it("propagates validation error on bad projectId", async () => {
    const result = await markNoteDoneAction(BAD_ID, NOTE_ID);
    expect(result).toEqual({ success: false, error: "validation" });
  });
});

describe("markNoteOpenAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNoteAction with status: open", async () => {
    const note = makeNote();
    mockUpdate.mockResolvedValueOnce(note);
    const result = await markNoteOpenAction(PROJECT_ID, NOTE_ID);
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID, { status: "open" });
    expect(result).toEqual({ success: true, note });
  });
});
