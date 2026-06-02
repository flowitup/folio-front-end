"use client";

/**
 * useNotesState — optimistic CRUD state for the notes wall.
 * Manages: note list state, add/save/delete handlers with snapshot rollback,
 * and sonner toasts on error. Extracted from NotesView to keep it under 200 lines.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { confirmDelete } from "./delete-confirm-toast";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "./actions";
import type { Note } from "@/lib/api/notes";
import type { QuickAddPayload } from "./quick-add";
import type { NoteSavePayload } from "./note-editor";

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

export interface UseNotesStateReturn {
  notes: Note[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  handleAdd: (payload: QuickAddPayload) => Promise<void>;
  handleSave: (noteId: string, payload: NoteSavePayload) => Promise<void>;
  handleDelete: (noteId: string) => void;
}

export function useNotesState(
  projectId: string,
  initialNotes: Note[]
): UseNotesStateReturn {
  const t = useTranslations("notes");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  return { notes, editingId, setEditingId, handleAdd, handleSave, handleDelete };
}
