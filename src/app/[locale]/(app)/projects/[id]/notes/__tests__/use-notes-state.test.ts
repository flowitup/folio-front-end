/**
 * Tests for useNotesState hook.
 * Covers: handleToggleDone optimistic flip, server success, rollback on failure.
 * Mirrors the pattern used in notes-view and other hook tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Note } from "@/lib/api/notes";

// ---- Module mocks (before imports) ----

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("../delete-confirm-toast", () => ({ confirmDelete: vi.fn() }));
vi.mock("../actions", () => ({
  createNoteAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
}));

// ---- Imports after mocks ----

const { useNotesState } = await import("../use-notes-state");
const { updateNoteAction } = await import("../actions");
const { toast } = await import("sonner");

const mockUpdate = vi.mocked(updateNoteAction);
const mockToastError = vi.mocked(toast.error);

// ---- Helpers ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID    = "22222222-2222-2222-2222-222222222222";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: NOTE_ID,
    project_id: PROJECT_ID,
    created_by: "user-1",
    title: "A note",
    description: null,
    category: "general",
    status: "open",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---- Tests ----

describe("useNotesState — handleToggleDone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("optimistically flips status open→done before server responds", async () => {
    const note = makeNote({ status: "open" });
    const serverNote = { ...note, status: "done" as const };
    mockUpdate.mockResolvedValueOnce({ success: true, note: serverNote });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone(NOTE_ID);
    });

    expect(result.current.notes[0].status).toBe("done");
  });

  it("optimistically flips status done→open", async () => {
    const note = makeNote({ status: "done" });
    const serverNote = { ...note, status: "open" as const };
    mockUpdate.mockResolvedValueOnce({ success: true, note: serverNote });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone(NOTE_ID);
    });

    expect(result.current.notes[0].status).toBe("open");
  });

  it("calls updateNoteAction with correct status payload", async () => {
    const note = makeNote({ status: "open" });
    const serverNote = { ...note, status: "done" as const };
    mockUpdate.mockResolvedValueOnce({ success: true, note: serverNote });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone(NOTE_ID);
    });

    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, NOTE_ID, { status: "done" });
  });

  it("rolls back to original status on server failure", async () => {
    const note = makeNote({ status: "open" });
    mockUpdate.mockResolvedValueOnce({ success: false, error: "generic" });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone(NOTE_ID);
    });

    expect(result.current.notes[0].status).toBe("open");
  });

  it("shows error toast on server failure", async () => {
    const note = makeNote({ status: "open" });
    mockUpdate.mockResolvedValueOnce({ success: false, error: "generic" });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone(NOTE_ID);
    });

    expect(mockToastError).toHaveBeenCalled();
  });

  it("does nothing when noteId is not found", async () => {
    const note = makeNote({ status: "open" });

    const { result } = renderHook(() => useNotesState(PROJECT_ID, [note]));

    await act(async () => {
      await result.current.handleToggleDone("non-existent-id");
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.current.notes[0].status).toBe("open");
  });
});
