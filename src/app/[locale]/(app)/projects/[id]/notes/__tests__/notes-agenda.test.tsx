/**
 * Tests for NotesAgenda component.
 *
 * Covers:
 * - Renders notes grouped into correct buckets
 * - Empty state shows when no notes
 * - "+ Add note" button opens the add-row
 * - Optimistic insert: new temp note appears immediately before server reply
 * - Optimistic delete with undo: row removed immediately, toast shown
 *
 * Timer strategy (following user-search.test.tsx pattern):
 *   vi.useFakeTimers() for confirmDelete's 4-second undo window,
 *   vi.useRealTimers() before waitFor assertions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NotesAgenda } from "../notes-agenda";
import type { Note } from "@/lib/api/notes";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const full = `${ns}.${key}`;
    if (params)
      return Object.entries(params).reduce<string>(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        full
      );
    return full;
  },
}));

// `toast` must be a callable spy (confirmDelete calls `toast(label, opts)` for
// the undo toast) that also carries .success/.info/.warning/.error methods.
// A single mock keeps this deterministic — a duplicate vi.mock("sonner") here
// made resolution order-dependent and flaked under different file scheduling.
vi.mock("sonner", () => {
  const toastFn = vi.fn();
  Object.assign(toastFn, {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

vi.mock("../actions", () => ({
  createNoteAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
  markNoteDoneAction: vi.fn(),
  markNoteOpenAction: vi.fn(),
}));

// ---- Imports after mocks ----

const { createNoteAction, updateNoteAction, deleteNoteAction } = await import("../actions");
const mockCreate = vi.mocked(createNoteAction);
const mockUpdate = vi.mocked(updateNoteAction);
const mockDelete = vi.mocked(deleteNoteAction);

const { toast } = await import("sonner");
const mockToast = toast as unknown as ReturnType<typeof vi.fn> & {
  error: ReturnType<typeof vi.fn>;
};

// ---- Helpers ----

const TODAY = (() => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
})();

function makeNote(id: string, dueDate: string, status: "open" | "done" = "open"): Note {
  return {
    id,
    project_id: "proj-1",
    created_by: "user-1",
    title: `Note ${id}`,
    description: null,
    due_date: dueDate,
    lead_time_minutes: 0,
    status,
    fire_at: "2024-06-15T09:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const PROJECT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// ---- Tests ----

describe("NotesAgenda — rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no notes and add-row is closed", () => {
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    expect(screen.getByText("notes.empty.title")).toBeDefined();
  });

  it("hides empty state when add-row is open", () => {
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    fireEvent.click(screen.getByText("notes.addButton"));
    expect(screen.queryByText("notes.empty.title")).toBeNull();
  });

  it("renders today notes under today bucket heading", () => {
    const notes = [makeNote("t1", TODAY)];
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={notes} />);
    expect(screen.getByText("notes.groups.today")).toBeDefined();
    expect(screen.getByText("Note t1")).toBeDefined();
  });

  it("renders done notes under done bucket heading", () => {
    const notes = [makeNote("d1", TODAY, "done")];
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={notes} />);
    expect(screen.getByText("notes.groups.done")).toBeDefined();
    expect(screen.getByText("Note d1")).toBeDefined();
  });

  it("does not render empty bucket headings", () => {
    const notes = [makeNote("t1", TODAY)];
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={notes} />);
    // No done notes → done heading absent
    expect(screen.queryByText("notes.groups.done")).toBeNull();
  });
});

describe("NotesAgenda — add-row interactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking Add note button opens the add-row form", () => {
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    fireEvent.click(screen.getByText("notes.addButton"));
    // The placeholder input should be visible
    expect(screen.getByPlaceholderText("notes.placeholderTitle")).toBeDefined();
  });

  it("Esc in the title input closes the add-row", () => {
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    fireEvent.click(screen.getByText("notes.addButton"));

    const input = screen.getByPlaceholderText("notes.placeholderTitle");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByPlaceholderText("notes.placeholderTitle")).toBeNull();
    expect(screen.getByText("notes.addButton")).toBeDefined();
  });

  it("optimistically inserts new note on Enter and replaces with server note", async () => {
    const serverNote = makeNote("server-id", TODAY);
    // createNoteAction returns { success: true, note } shape
    mockCreate.mockResolvedValueOnce({ success: true, note: serverNote } as never);

    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    fireEvent.click(screen.getByText("notes.addButton"));

    const input = screen.getByPlaceholderText("notes.placeholderTitle");
    fireEvent.change(input, { target: { value: "My new note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Optimistic note appears before server resolves
    await waitFor(() => {
      expect(screen.getByText("My new note")).toBeDefined();
    });

    // After server responds, "Note server-id" (makeNote title) replaces temp
    await waitFor(() => {
      expect(screen.getByText("Note server-id")).toBeDefined();
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  }, 15000);

  it("removes temp note on createNoteAction failure", async () => {
    mockCreate.mockResolvedValueOnce({ success: false, error: "generic" } as never);

    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[]} />);
    fireEvent.click(screen.getByText("notes.addButton"));

    const input = screen.getByPlaceholderText("notes.placeholderTitle");
    fireEvent.change(input, { target: { value: "Failing note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByText("Failing note")).toBeNull();
    });
    expect(mockToast.error).toHaveBeenCalled();
  }, 15000);
});

describe("NotesAgenda — optimistic delete with undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes note immediately on delete and calls toast for undo", async () => {
    const note = makeNote("del-1", TODAY);
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[note]} />);

    // Note should be visible initially
    expect(screen.getByText("Note del-1")).toBeDefined();

    // Click delete button (aria-label: notes.actions.delete)
    const deleteBtn = screen.getByRole("button", { name: /notes\.actions\.delete/i });
    fireEvent.click(deleteBtn);

    // Note removed optimistically
    expect(screen.queryByText("Note del-1")).toBeNull();
    // Toast called with undo option
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it("calls deleteNoteAction after undo window expires", async () => {
    mockDelete.mockResolvedValueOnce({ success: true });
    const note = makeNote("del-2", TODAY);
    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[note]} />);

    const deleteBtn = screen.getByRole("button", { name: /notes\.actions\.delete/i });
    fireEvent.click(deleteBtn);

    // Advance past the 4-second undo window
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    vi.useRealTimers();
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, "del-2");
    });
  }, 15000);
});

describe("NotesAgenda — update note (onSave)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNoteAction with note id and payload on save", async () => {
    const note = makeNote("upd-1", TODAY);
    const updatedNote = { ...note, title: "Updated title" };
    mockUpdate.mockResolvedValueOnce({ success: true, note: updatedNote } as never);

    render(<NotesAgenda projectId={PROJECT_ID} initialNotes={[note]} />);

    // Click the title to enter edit mode
    fireEvent.click(screen.getByText("Note upd-1"));

    const titleInput = screen.getByDisplayValue("Note upd-1");
    fireEvent.change(titleInput, { target: { value: "Updated title" } });
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        PROJECT_ID,
        "upd-1",
        expect.objectContaining({ title: "Updated title" })
      );
    });
  }, 15000);
});
