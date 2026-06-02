/**
 * Tests for NotesView component.
 * Covers: empty state, notes render, optimistic add, optimistic delete+undo,
 * filter chips, search.
 *
 * Timer strategy: vi.useFakeTimers for confirmDelete's 4s undo window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NotesView } from "../notes-view";
import type { Note } from "@/lib/api/notes";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, _params?: Record<string, unknown>) =>
    `${ns}.${key}`,
}));

vi.mock("sonner", () => {
  const toastFn = vi.fn();
  Object.assign(toastFn, {
    success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn(),
  });
  return { toast: toastFn };
});

vi.mock("../actions", () => ({
  createNoteAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
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

const PROJECT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makeNote(id: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    project_id: PROJECT_ID,
    created_by: "user-1",
    title: `Note ${id}`,
    description: null,
    category: "general",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Tests: empty state ----

describe("NotesView — empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no notes", () => {
    render(<NotesView projectId={PROJECT_ID} initialNotes={[]} />);
    expect(screen.getByText("notes.empty.title")).toBeDefined();
  });

  it("does not show toolbar when no notes", () => {
    render(<NotesView projectId={PROJECT_ID} initialNotes={[]} />);
    expect(screen.queryByPlaceholderText("notes.search.placeholder")).toBeNull();
  });
});

// ---- Tests: notes render ----

describe("NotesView — rendering notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders note titles", () => {
    const notes = [makeNote("n1"), makeNote("n2")];
    render(<NotesView projectId={PROJECT_ID} initialNotes={notes} />);
    expect(screen.getByText("Note n1")).toBeDefined();
    expect(screen.getByText("Note n2")).toBeDefined();
  });

  it("shows toolbar when notes are present", () => {
    render(<NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} />);
    expect(screen.getByPlaceholderText("notes.search.placeholder")).toBeDefined();
  });

  it("groups notes under a section heading", () => {
    render(<NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} />);
    // today/yesterday/week/earlier — one of these headings should appear
    const headings = screen.queryAllByRole("heading", { level: 2 });
    expect(headings.length).toBeGreaterThan(0);
  });
});

// ---- Tests: optimistic add ----

describe("NotesView — optimistic add", () => {
  beforeEach(() => vi.clearAllMocks());

  it("optimistically inserts note then replaces with server note", async () => {
    const serverNote = makeNote("server-id");
    mockCreate.mockResolvedValueOnce({ success: true, note: serverNote } as never);

    render(<NotesView projectId={PROJECT_ID} initialNotes={[]} />);

    // Type in QuickAdd title
    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "New Note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Temp note appears
    await waitFor(() => {
      expect(screen.getByText("New Note")).toBeDefined();
    });

    // Server note replaces temp
    await waitFor(() => {
      expect(screen.getByText("Note server-id")).toBeDefined();
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  }, 15000);

  it("removes temp note on createNoteAction failure", async () => {
    mockCreate.mockResolvedValueOnce({ success: false, error: "generic" } as never);

    render(<NotesView projectId={PROJECT_ID} initialNotes={[]} />);

    const input = screen.getByPlaceholderText("notes.quickAdd.placeholderTitle");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Failing note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByText("Failing note")).toBeNull();
    });
    expect(mockToast.error).toHaveBeenCalled();
  }, 15000);
});

// ---- Tests: optimistic delete ----

describe("NotesView — optimistic delete with undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes note immediately on delete and calls toast", async () => {
    const note = makeNote("del-1");
    render(<NotesView projectId={PROJECT_ID} initialNotes={[note]} />);

    expect(screen.getByText("Note del-1")).toBeDefined();

    const deleteBtn = screen.getByRole("button", { name: /notes\.actions\.delete/i });
    fireEvent.click(deleteBtn);

    expect(screen.queryByText("Note del-1")).toBeNull();
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it("calls deleteNoteAction after undo window expires", async () => {
    mockDelete.mockResolvedValueOnce({ success: true } as never);
    const note = makeNote("del-2");
    render(<NotesView projectId={PROJECT_ID} initialNotes={[note]} />);

    fireEvent.click(screen.getByRole("button", { name: /notes\.actions\.delete/i }));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    vi.useRealTimers();
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, "del-2");
    });
  }, 15000);
});

// ---- Tests: filter by category ----

describe("NotesView — category filter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only matching notes when a category chip is clicked", async () => {
    const notes = [
      makeNote("d1", { category: "delivery", title: "Delivery note" }),
      makeNote("g1", { category: "general", title: "General note" }),
    ];
    render(<NotesView projectId={PROJECT_ID} initialNotes={notes} />);

    // Multiple elements may show "notes.categories.delivery" (chip + card tag)
    // Find the chip button specifically (inside .filter-chips)
    const deliveryChips = screen.getAllByText("notes.categories.delivery");
    // The filter chip is the one that is a button itself or whose closest button has chip class
    const chipBtn = deliveryChips
      .map((el) => el.closest("button"))
      .find((btn) => btn?.className.includes("chip"));
    expect(chipBtn).toBeDefined();
    fireEvent.click(chipBtn!);

    await waitFor(() => {
      expect(screen.getByText("Delivery note")).toBeDefined();
      expect(screen.queryByText("General note")).toBeNull();
    });
  });

  it("shows no-match state when filter yields no results", async () => {
    const notes = [makeNote("g1", { category: "general", title: "General note" })];
    render(<NotesView projectId={PROJECT_ID} initialNotes={notes} />);

    // Click call chip — no call notes exist but it won't appear unless counts > 0
    // Instead use search to produce no-match
    const searchInput = screen.getByPlaceholderText("notes.search.placeholder");
    fireEvent.change(searchInput, { target: { value: "zzznomatch" } });

    await waitFor(() => {
      expect(screen.getByText("notes.noMatch.title")).toBeDefined();
    });
  });
});

// ---- Tests: search ----

describe("NotesView — search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters notes by search query (title match)", async () => {
    const notes = [
      makeNote("a1", { title: "Alpha note" }),
      makeNote("b1", { title: "Beta note" }),
    ];
    render(<NotesView projectId={PROJECT_ID} initialNotes={notes} />);

    fireEvent.change(screen.getByPlaceholderText("notes.search.placeholder"), {
      target: { value: "Alpha" },
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha note")).toBeDefined();
      expect(screen.queryByText("Beta note")).toBeNull();
    });
  });

  it("shows clear button when query is non-empty and clears on click", async () => {
    render(<NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} />);

    const searchInput = screen.getByPlaceholderText("notes.search.placeholder");
    fireEvent.change(searchInput, { target: { value: "test" } });

    const clearBtn = await screen.findByRole("button", { name: /notes\.search\.clear/i });
    fireEvent.click(clearBtn);

    expect((searchInput as HTMLInputElement).value).toBe("");
  });

  it("filters by description text", async () => {
    const notes = [
      makeNote("a1", { title: "A", description: "unique-desc-xyz" }),
      makeNote("b1", { title: "B", description: null }),
    ];
    render(<NotesView projectId={PROJECT_ID} initialNotes={notes} />);

    fireEvent.change(screen.getByPlaceholderText("notes.search.placeholder"), {
      target: { value: "unique-desc-xyz" },
    });

    await waitFor(() => {
      expect(screen.getByText("A")).toBeDefined();
      expect(screen.queryByText("B")).toBeNull();
    });
  });
});

// ---- Tests: update note ----

describe("NotesView — update note", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateNoteAction when a note is saved from NoteEditor", async () => {
    const note = makeNote("upd-1", { title: "Original title" });
    const updatedNote = { ...note, title: "Updated title" };
    mockUpdate.mockResolvedValueOnce({ success: true, note: updatedNote } as never);

    render(<NotesView projectId={PROJECT_ID} initialNotes={[note]} />);

    // Click edit button to enter edit mode (avoids article click ambiguity)
    fireEvent.click(screen.getByRole("button", { name: /notes\.actions\.edit/i }));

    // Change the title in editor
    const titleInput = screen.getByDisplayValue("Original title");
    fireEvent.change(titleInput, { target: { value: "Updated title" } });

    // Save via Cmd+Enter on the note-editor container div
    const editor = document.querySelector(".note-editor")!;
    fireEvent.keyDown(editor, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        PROJECT_ID,
        "upd-1",
        expect.objectContaining({ title: "Updated title" })
      );
    });
  }, 15000);
});
