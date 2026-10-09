/**
 * Tests for NoteCard component.
 * Covers: read view renders title/category/footer, done checkbox toggle,
 * done modifier class, edit/delete hover actions, isEditing renders NoteEditor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteCard } from "../note-card";
import type { Note } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    values ? `${ns}.${key}(${JSON.stringify(values)})` : `${ns}.${key}`,
  useLocale: () => "fr",
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
      />
    );
    expect(screen.getByText(/notes\.addedToday/)).toBeDefined();
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
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
        canEdit={true}
      />
    );
    expect(screen.queryByRole("article")).toBeNull();
  });
});

describe("NoteCard — added date", () => {
  it("formats an older date in the app locale inside one message", () => {
    render(
      <NoteCard
        note={makeNote({ created_at: new Date(2026, 0, 21, 12).toISOString() })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
        canEdit
      />
    );
    expect(screen.getByText(/notes\.addedOn/).textContent).toContain("21 janv.");
  });
});

describe("NoteCard — today / yesterday in the viewer's time zone", () => {
  const savedTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  function renderAddedAt(createdAt: string) {
    render(
      <NoteCard
        note={makeNote({ created_at: createdAt })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
        canEdit
      />
    );
  }

  it("says 'today' for a note added at 01:13 Hanoi time (still yesterday in UTC)", () => {
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z")); // 10 Oct 10:00 Hanoi
    renderAddedAt("2026-10-09T18:13:00+00:00"); // 10 Oct 01:13 Hanoi
    expect(screen.getByText("notes.addedToday")).toBeDefined();
  });

  it("says 'yesterday' for a note added late yesterday evening (same UTC day)", () => {
    vi.setSystemTime(new Date("2026-10-09T22:00:00Z")); // 10 Oct 05:00 Hanoi
    renderAddedAt("2026-10-09T16:48:23.164602+00:00"); // 9 Oct 23:48 Hanoi
    expect(screen.getByText("notes.addedYesterday")).toBeDefined();
  });

  it("dates an older note on its local day", () => {
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
    renderAddedAt("2026-10-07T18:30:00+00:00"); // 8 Oct 01:30 Hanoi, 7 Oct in UTC
    expect(screen.getByText(/notes\.addedOn/).textContent).toContain("8 oct.");
  });
});

describe("NoteCard — year of an older note", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function addedText(createdAt: string): string {
    render(
      <NoteCard
        note={makeNote({ created_at: createdAt })}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
        canEdit
      />
    );
    return screen.getByText(/notes\.addedOn/).textContent ?? "";
  }

  it("shows the year of a note from another year", () => {
    // Local noons, so the days hold in any time zone the suite runs in.
    vi.setSystemTime(new Date(2027, 9, 12, 12));
    expect(addedText(new Date(2026, 9, 9, 12).toISOString())).toContain("9 oct. 2026");
  });

  it("leaves the year out for a note from this year", () => {
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    expect(addedText(new Date(2026, 9, 9, 12).toISOString())).not.toContain("2026");
  });
});
