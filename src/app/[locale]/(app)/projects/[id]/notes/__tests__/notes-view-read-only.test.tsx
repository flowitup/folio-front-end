/**
 * Journal read-only mode.
 *
 * Notes stay readable for every project member, but every note write needs
 * effective `project:update` on the backend — so a member gets the wall with
 * no capture box, no edit/delete actions and no done toggle, while a manager
 * keeps the full set of controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotesView } from "../notes-view";
import type { Note } from "@/lib/api/notes";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
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

// ---- Helpers ----

const PROJECT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makeNote(id: string): Note {
  return {
    id,
    project_id: PROJECT_ID,
    created_by: "user-1",
    title: `Note ${id}`,
    description: "Body text",
    category: "general",
    status: "open" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

beforeEach(() => vi.clearAllMocks());

// ---- Tests ----

describe("NotesView — member (canEdit=false)", () => {
  it("still renders the notes themselves", () => {
    render(
      <NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} canEdit={false} />
    );
    expect(screen.getByText("Note n1")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("hides the quick-add capture box", () => {
    render(
      <NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} canEdit={false} />
    );
    expect(screen.queryByPlaceholderText("notes.quickAdd.placeholderTitle")).toBeNull();
  });

  it("hides the per-note edit, delete and done controls", () => {
    render(
      <NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} canEdit={false} />
    );
    expect(screen.queryByLabelText("notes.actions.edit")).toBeNull();
    expect(screen.queryByLabelText("notes.actions.delete")).toBeNull();
    expect(screen.queryByLabelText("notes.markDone")).toBeNull();
  });

  it("does not open the inline editor when the card is clicked", () => {
    render(
      <NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} canEdit={false} />
    );
    fireEvent.click(screen.getByText("Note n1"));
    // The editor swaps the title for a text input — it must stay closed.
    expect(screen.queryByPlaceholderText("notes.editor.placeholderTitle")).toBeNull();
    expect(screen.getByText("Note n1")).toBeInTheDocument();
  });
});

describe("NotesView — manager (canEdit=true)", () => {
  it("renders the quick-add box and the per-note controls", () => {
    render(
      <NotesView projectId={PROJECT_ID} initialNotes={[makeNote("n1")]} canEdit />
    );
    expect(screen.getByPlaceholderText("notes.quickAdd.placeholderTitle")).toBeInTheDocument();
    expect(screen.getByLabelText("notes.actions.edit")).toBeInTheDocument();
    expect(screen.getByLabelText("notes.actions.delete")).toBeInTheDocument();
    expect(screen.getByLabelText("notes.markDone")).toBeInTheDocument();
  });
});
