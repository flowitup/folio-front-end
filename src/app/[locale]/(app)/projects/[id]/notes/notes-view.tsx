"use client";

/**
 * NotesView — top-level client orchestrator for the journal notes wall.
 * Manages: note list state, optimistic CRUD, filter/search, grouped masonry.
 * Ports the artifact's NotesView component adapted to the real app.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { buildSections } from "@/lib/notes/grouping";
import { CATEGORY_ORDER } from "@/lib/notes/categories";
import { QuickAdd } from "./quick-add";
import { NotesToolbar } from "./notes-toolbar";
import { NoteCard } from "./note-card";
import { confirmDelete } from "./delete-confirm-toast";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "./actions";
import type { Note, NoteCategory } from "@/lib/api/notes";
import type { ActiveCat } from "./filter-chips";
import type { QuickAddPayload } from "./quick-add";
import type { NoteSavePayload } from "./note-editor";

interface NotesViewProps {
  projectId: string;
  initialNotes: Note[];
}

const TEMP_PREFIX = "temp-";
const makeTempId = () => `${TEMP_PREFIX}${crypto.randomUUID()}`;

function makeTempNote(
  projectId: string,
  tempId: string,
  payload: QuickAddPayload
): Note {
  const now = new Date().toISOString();
  return {
    id: tempId,
    project_id: projectId,
    created_by: "",
    title: payload.title,
    description: payload.description,
    category: payload.category,
    created_at: now,
    updated_at: now,
  };
}

export function NotesView({ projectId, initialNotes }: NotesViewProps) {
  const t = useTranslations("notes");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ActiveCat>("all");

  // ---- Derived data ----

  const counts = Object.fromEntries(
    CATEGORY_ORDER.map((k) => [k, notes.filter((n) => n.category === k).length])
  ) as Record<NoteCategory, number>;

  const q = query.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    if (activeCat !== "all" && n.category !== activeCat) return false;
    if (!q) return true;
    return (n.title + " " + (n.description ?? "")).toLowerCase().includes(q);
  });

  const sections = buildSections(filtered, "date");
  const isEmpty = notes.length === 0;

  // ---- Handlers ----

  const handleAdd = useCallback(
    async (payload: QuickAddPayload) => {
      const tempId = makeTempId();
      const tempNote = makeTempNote(projectId, tempId, payload);
      setNotes((prev) => [tempNote, ...prev]);

      const result = await createNoteAction(projectId, payload);
      if (result.success) {
        setNotes((prev) => prev.map((n) => (n.id === tempId ? result.note : n)));
      } else {
        setNotes((prev) => prev.filter((n) => n.id !== tempId));
        toast.error(t("errors.saveFailed"));
      }
    },
    [projectId, t]
  );

  const handleSave = useCallback(
    async (noteId: string, payload: NoteSavePayload) => {
      const snapshot = [...notes];
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, ...payload } : n))
      );
      setEditingId(null);

      const result = await updateNoteAction(projectId, noteId, payload);
      if (result.success) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? result.note : n)));
      } else {
        setNotes(snapshot);
        setEditingId(noteId);
        toast.error(t("errors.saveFailed"));
      }
    },
    [notes, projectId, t]
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;

      confirmDelete({
        label: t("deleted.toast"),
        undoLabel: t("deleted.undo"),
        onRemove: () => {
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
          setEditingId(null);
        },
        onConfirm: async () => {
          const result = await deleteNoteAction(projectId, noteId);
          if (!result.success) {
            setNotes((prev) => [target, ...prev]);
            toast.error(t("errors.deleteFailed"));
          }
        },
        onError: () => {
          setNotes((prev) => [target, ...prev]);
          toast.error(t("errors.deleteFailed"));
        },
      });
    },
    [notes, projectId, t]
  );

  // ---- Render ----

  return (
    <div className="notes-wrap wide">
      <QuickAdd onAdd={(p) => void handleAdd(p)} disabled={false} />

      {!isEmpty && (
        <NotesToolbar
          counts={counts}
          activeCat={activeCat}
          onPickCat={setActiveCat}
          query={query}
          onQueryChange={setQuery}
        />
      )}

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-glyph"><FileText size={28} /></div>
          <h3 className="font-display">{t("empty.title")}</h3>
          <p>{t("empty.body")}</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="empty-state">
          <div className="empty-glyph"><FileText size={26} /></div>
          <h3 className="font-display">{t("noMatch.title")}</h3>
          <p>{t("noMatch.body")}</p>
        </div>
      ) : (
        sections.map((sec) => (
          <section className="agenda-section" key={sec.key}>
            <div className="agenda-head">
              {sec.dotColor && (
                <span
                  className="cat-dot"
                  style={{ background: sec.dotColor, width: 10, height: 10 }}
                />
              )}
              <h2>{t(sec.labelKey.replace("notes.", "") as Parameters<typeof t>[0])}</h2>
              <span className="rule" />
              <span className="count num">{sec.items.length}</span>
            </div>
            <div className="notes-grid">
              {sec.items.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isEditing={editingId === note.id}
                  onStartEdit={() => setEditingId(note.id)}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
