"use client";

/**
 * useNotesState — optimistic CRUD state for the notes wall.
 * Manages: note list state, add/save/delete handlers with snapshot rollback,
 * and sonner toasts on error. Extracted from NotesView to keep it under 200 lines.
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { confirmDelete, flushPendingDeletes } from "./delete-confirm-toast";
import { env } from "@/lib/config/env";
import { getCsrfHeader } from "@/lib/api/http";
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
    description: payload.description ?? null,
    category: payload.category,
    status: "open",
    created_at: now,
    updated_at: now,
  };
}

/**
 * Delete a note from the browser straight to the API, surviving page unload
 * (`keepalive`). Used only to flush a delete still in its undo window when
 * the user leaves: the server action cannot be relied on once the page or
 * route is going away.
 */
function sendNoteDeleteNow(projectId: string, noteId: string): void {
  try {
    void fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
        headers: getCsrfHeader("DELETE"),
      }
    ).catch(() => {});
  } catch {
    // Nothing more can be done while the page unloads.
  }
}

export interface UseNotesStateReturn {
  notes: Note[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  handleAdd: (payload: QuickAddPayload) => Promise<void>;
  handleSave: (noteId: string, payload: NoteSavePayload) => Promise<void>;
  handleDelete: (noteId: string) => void;
  handleToggleDone: (noteId: string) => Promise<void>;
}

export function useNotesState(
  projectId: string,
  initialNotes: Note[]
): UseNotesStateReturn {
  const t = useTranslations("notes");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Leaving the notes view (client-side navigation) must not drop a delete
  // the user was told had happened.
  useEffect(() => () => flushPendingDeletes(), []);

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
      const index = notes.findIndex((n) => n.id === noteId);
      const target = notes[index];
      if (!target) return;

      // Put the note back where it was (or at the top if the list moved on).
      const restore = () =>
        setNotes((prev) => {
          if (prev.some((n) => n.id === noteId)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, target);
          return next;
        });

      confirmDelete({
        label: t("deleted.toast"),
        undoLabel: t("deleted.undo"),
        onRemove: () => {
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
          setEditingId(null);
        },
        onUndo: restore,
        onConfirm: async () => {
          const result = await deleteNoteAction(projectId, noteId);
          if (!result.success) {
            restore();
            toast.error(t("errors.deleteFailed"));
          }
        },
        sendNow: () => sendNoteDeleteNow(projectId, noteId),
        onError: () => {
          restore();
          toast.error(t("errors.deleteFailed"));
        },
      });
    },
    [notes, projectId, t]
  );

  const handleToggleDone = useCallback(
    async (noteId: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;

      const nextStatus: "open" | "done" = target.status === "done" ? "open" : "done";
      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, status: nextStatus } : n))
      );

      const result = await updateNoteAction(projectId, noteId, { status: nextStatus });
      if (result.success) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? result.note : n)));
      } else {
        // Rollback
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, status: target.status } : n))
        );
        toast.error(t("errors.saveFailed"));
      }
    },
    [notes, projectId, t]
  );

  return { notes, editingId, setEditingId, handleAdd, handleSave, handleDelete, handleToggleDone };
}
