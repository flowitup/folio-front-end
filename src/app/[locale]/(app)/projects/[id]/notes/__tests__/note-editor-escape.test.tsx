/**
 * Escape in the note editor: with the category menu open it closes only the
 * menu. It used to bubble on to the editor, which cancelled and dropped the
 * typed title and body. A plain Escape still cancels the editor.
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NoteEditor } from "../note-editor";
import type { Note } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const NOTE: Note = {
  id: "n1",
  project_id: "p1",
  created_by: "u1",
  title: "Alice note",
  description: null,
  category: "general",
  status: "open",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function renderEditor() {
  const onCancel = vi.fn();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<NoteEditor note={NOTE} onSave={onSave} onCancel={onCancel} onDelete={vi.fn()} />);
  return { onCancel, onSave };
}

const pill = () => screen.getByRole("button", { name: /notes\.categories\.general/ });
const titleInput = () => screen.getByLabelText("notes.editor.placeholderTitle");

describe("NoteEditor Escape", () => {
  it("closes only the category menu when it is open, keeping the edits", () => {
    const { onCancel } = renderEditor();
    fireEvent.change(titleInput(), { target: { value: "Alice note EDITED" } });
    fireEvent.click(pill());
    pill().focus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(pill(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(titleInput()).toHaveValue("Alice note EDITED");
  });

  it("closes only the menu when Escape is pressed on one of its options", () => {
    const { onCancel } = renderEditor();
    fireEvent.click(pill());
    const option = screen.getByRole("option", { name: /notes\.categories\.delivery/ });
    option.focus();

    fireEvent.keyDown(option, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    // Focus goes back to the pill rather than being lost with the menu.
    expect(pill()).toHaveFocus();
  });

  it("still cancels the editor on Escape when no menu is open", () => {
    const { onCancel } = renderEditor();
    fireEvent.keyDown(titleInput(), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
