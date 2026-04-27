/**
 * Tests for NoteRow component
 *
 * Covers:
 * - Display mode renders title and due_date
 * - Click title → edit mode (onStartEdit)
 * - Edit mode: Enter key fires onSave
 * - Edit mode: Esc key fires onCancel and resets local state
 * - Edit mode: trash button calls onDelete and onCancel (no onSave race)
 * - aria-label correctness on edit/delete buttons
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NoteRow } from "../note-row";
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

// NoteStatusToggle uses router — mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock server actions used by NoteStatusToggle
vi.mock("../actions", () => ({
  markNoteDoneAction: vi.fn(),
  markNoteOpenAction: vi.fn(),
  createNoteAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
}));

// ---- Fixtures ----

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-123",
    project_id: "proj-1",
    created_by: "user-1",
    title: "Write tests",
    description: null,
    due_date: "2024-06-15",
    lead_time_minutes: 0,
    status: "open",
    fire_at: "2024-06-15T09:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderRow(
  props: Partial<{
    note: Note;
    isEditing: boolean;
    onStartEdit: () => void;
    onSave: (id: string, payload: unknown) => Promise<void>;
    onCancel: () => void;
    onDelete: (id: string) => void;
    onStatusChange: (n: Note) => void;
  }> = {}
) {
  const defaults = {
    note: makeNote(),
    isEditing: false,
    onStartEdit: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return { ...merged, ...render(<NoteRow {...merged} />) };
}

// ---- Tests ----

describe("NoteRow — display mode", () => {
  it("renders the note title", () => {
    renderRow();
    expect(screen.getByText("Write tests")).toBeDefined();
  });

  it("renders the due_date chip", () => {
    renderRow();
    expect(screen.getByText("2024-06-15")).toBeDefined();
  });

  it("has aria-label on edit button", () => {
    renderRow();
    const editBtn = screen.getByRole("button", { name: /notes\.actions\.edit/i });
    expect(editBtn).toBeDefined();
  });

  it("has aria-label on delete button (display mode)", () => {
    renderRow();
    const deleteBtn = screen.getByRole("button", { name: /notes\.actions\.delete/i });
    expect(deleteBtn).toBeDefined();
  });

  it("calls onStartEdit when title button is clicked", () => {
    const onStartEdit = vi.fn();
    renderRow({ onStartEdit });
    // The title is rendered as a button; click the note title text button
    fireEvent.click(screen.getByText("Write tests"));
    expect(onStartEdit).toHaveBeenCalledTimes(1);
  });
});

describe("NoteRow — edit mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a form with role=form when isEditing=true", () => {
    renderRow({ isEditing: true });
    expect(screen.getByRole("form")).toBeDefined();
  });

  it("renders a title input pre-filled with note.title", () => {
    renderRow({ isEditing: true });
    const input = screen.getByDisplayValue("Write tests");
    expect(input).toBeDefined();
  });

  it("Enter key on title input fires onSave with current values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderRow({ isEditing: true, onSave });

    const input = screen.getByDisplayValue("Write tests");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const [noteId, payload] = onSave.mock.calls[0] as [string, Record<string, unknown>];
    expect(noteId).toBe("note-123");
    expect(payload.title).toBe("Write tests");
    expect(payload.due_date).toBe("2024-06-15");
  });

  it("Esc key fires onCancel and does NOT fire onSave", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderRow({ isEditing: true, onSave, onCancel });

    const input = screen.getByDisplayValue("Write tests");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Esc key resets local title to original note.title", () => {
    const onCancel = vi.fn();
    renderRow({ isEditing: true, onCancel });

    const input = screen.getByDisplayValue("Write tests") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Changed title" } });
    expect(input.value).toBe("Changed title");

    fireEvent.keyDown(input, { key: "Escape" });
    // After Esc, the component resets state — title should revert
    expect(input.value).toBe("Write tests");
  });

  it("Save button click fires onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderRow({ isEditing: true, onSave });

    const saveBtn = screen.getByRole("button", { name: /notes\.actions\.save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it("Cancel button click fires onCancel without firing onSave", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderRow({ isEditing: true, onSave, onCancel });

    const cancelBtn = screen.getByRole("button", { name: /notes\.actions\.cancel/i });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("trash button calls onDelete with noteId and does NOT fire onSave", async () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onCancel = vi.fn();
    renderRow({ isEditing: true, onSave, onDelete, onCancel });

    const trashBtn = screen.getByRole("button", { name: /notes\.actions\.delete/i });
    fireEvent.click(trashBtn);

    // onCancel (exit edit mode) and onDelete should fire; onSave must not
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("note-123");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Shift+Enter does NOT fire onSave (only plain Enter does)", () => {
    const onSave = vi.fn();
    renderRow({ isEditing: true, onSave });

    const input = screen.getByDisplayValue("Write tests");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("NoteRow — done status strikethrough", () => {
  it("applies line-through style to title when note.status == done", () => {
    const note = makeNote({ status: "done" });
    renderRow({ note });
    const titleBtn = screen.getByText("Write tests");
    // Inline style contains text-decoration: line-through
    expect((titleBtn as HTMLElement).style.textDecoration).toContain("line-through");
  });
});
