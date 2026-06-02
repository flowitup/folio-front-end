/**
 * Tests for NoteCard component.
 * Covers: read view renders title/category/footer, done checkbox toggle,
 * done modifier class, edit/delete hover actions, isEditing renders NoteEditor.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteCard } from "../note-card";
import type { Note } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    project_id: "proj-1",
    created_by: "user-1",
    title: "Test Note Title",
    description: "Test description",
    category: "delivery",
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("NoteCard — read view", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the note title", () => {
    render(
      <NoteCard
        note={makeNote()}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByText("Test Note Title")).toBeDefined();
  });

  it("renders the category tag label", () => {
    render(
      <NoteCard
        note={makeNote({ category: "payment" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByText("notes.categories.payment")).toBeDefined();
  });

  it("renders the description when present", () => {
    render(
      <NoteCard
        note={makeNote({ description: "Some body text" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByText("Some body text")).toBeDefined();
  });

  it("does not render body paragraph when description is null", () => {
    render(
      <NoteCard
        note={makeNote({ description: null })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.queryByRole("paragraph")).toBeNull();
  });

  it("renders the 'Added' footer", () => {
    render(
      <NoteCard
        note={makeNote()}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByText(/notes\.addedLabel/)).toBeDefined();
  });

  it("calls onStartEdit when article is clicked outside nc-actions", () => {
    const onStartEdit = vi.fn();
    render(
      <NoteCard
        note={makeNote()}
        isEditing={false}
        onStartEdit={onStartEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    const article = screen.getByRole("article");
    fireEvent.click(article);
    expect(onStartEdit).toHaveBeenCalledTimes(1);
  });

  it("renders edit and delete icon buttons", () => {
    render(
      <NoteCard
        note={makeNote()}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /notes\.actions\.edit/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /notes\.actions\.delete/i })).toBeDefined();
  });

  it("calls onDelete with note id when delete button is clicked", () => {
    const onDelete = vi.fn();
    const note = makeNote();
    render(
      <NoteCard
        note={note}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
        onToggleDone={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /notes\.actions\.delete/i }));
    expect(onDelete).toHaveBeenCalledWith(note.id);
  });
});

describe("NoteCard — done checkbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders checkbox with markDone aria-label when status is open", () => {
    render(
      <NoteCard
        note={makeNote({ status: "open" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /notes\.markDone/i })).toBeDefined();
  });

  it("renders checkbox with markOpen aria-label when status is done", () => {
    render(
      <NoteCard
        note={makeNote({ status: "done" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /notes\.markOpen/i })).toBeDefined();
  });

  it("calls onToggleDone with note id when checkbox is clicked", () => {
    const onToggleDone = vi.fn();
    const note = makeNote({ status: "open" });
    render(
      <NoteCard
        note={note}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={onToggleDone}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /notes\.markDone/i }));
    expect(onToggleDone).toHaveBeenCalledWith(note.id);
  });

  it("does NOT call onStartEdit when checkbox is clicked (stopPropagation)", () => {
    const onStartEdit = vi.fn();
    render(
      <NoteCard
        note={makeNote({ status: "open" })}
        isEditing={false}
        onStartEdit={onStartEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /notes\.markDone/i }));
    expect(onStartEdit).not.toHaveBeenCalled();
  });

  it("adds 'done' class to article when status is done", () => {
    render(
      <NoteCard
        note={makeNote({ status: "done" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    const article = screen.getByRole("article");
    expect(article.className).toContain("done");
  });

  it("does NOT add 'done' class when status is open", () => {
    render(
      <NoteCard
        note={makeNote({ status: "open" })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    const article = screen.getByRole("article");
    expect(article.className).not.toContain("done");
  });
});

describe("NoteCard — edit mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders NoteEditor when isEditing=true", () => {
    render(
      <NoteCard
        note={makeNote()}
        isEditing={true}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("notes.editor.placeholderTitle")).toBeDefined();
  });

  it("does not render the article card when editing", () => {
    render(
      <NoteCard
        note={makeNote()}
        isEditing={true}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );
    expect(screen.queryByRole("article")).toBeNull();
  });
});
