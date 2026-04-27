"use client";

/**
 * NotesAgenda — top-level client orchestrator for the notes page.
 * Manages: note list state, optimistic CRUD, grouping render, add-row.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { groupNotesByDay } from "@/lib/notes/grouping";
import { NoteRow } from "./note-row";
import { confirmDelete } from "./delete-confirm-toast";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "./actions";
import type { Note, LeadTimeMinutes } from "@/lib/api/notes";

interface NotesAgendaProps {
  projectId: string;
  initialNotes: Note[];
}

type EditingId = string | null; // note id, "new" for add-row, null for none

const BUCKET_ORDER = ["today", "tomorrow", "thisWeek", "later", "done"] as const;

// Prefix optimistic IDs so they never collide with real BE UUIDs.
const TEMP_PREFIX = "temp-";
const makeTempId = () => `${TEMP_PREFIX}${crypto.randomUUID()}`;

// Minimal temp note shape for optimistic insert
function makeTempNote(
  projectId: string,
  tempId: string,
  title: string,
  dueDate: string,
  leadTime: LeadTimeMinutes
): Note {
  const now = new Date().toISOString();
  return {
    id: tempId,
    project_id: projectId,
    created_by: "",
    title,
    description: null,
    due_date: dueDate,
    lead_time_minutes: leadTime,
    status: "open",
    fire_at: now,
    created_at: now,
    updated_at: now,
  };
}

function todayISODate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function NotesAgenda({ projectId, initialNotes }: NotesAgendaProps) {
  const t = useTranslations("notes");
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [editingId, setEditingId] = useState<EditingId>(null);

  // ---- Add-row local state ----
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(todayISODate());
  const [newLeadTime, setNewLeadTime] = useState<LeadTimeMinutes>(0);
  const [isAdding, setIsAdding] = useState(false);

  const grouped = groupNotesByDay(notes);

  // ---- Handlers ----

  const handleSave = useCallback(
    async (
      noteId: string,
      payload: {
        title: string;
        due_date: string;
        lead_time_minutes: LeadTimeMinutes;
        description: string | null;
      }
    ) => {
      // Snapshot for rollback
      const snapshot = [...notes];
      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, ...payload } : n))
      );
      setEditingId(null);

      const result = await updateNoteAction(projectId, noteId, payload);
      if (result.success) {
        // Replace with server-canonical record
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? result.note : n))
        );
      } else {
        setNotes(snapshot);
        toast.error(t("errors.saveFailed"));
      }
    },
    [notes, projectId, t]
  );

  const handleStatusChange = useCallback((updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleDelete = useCallback(
    (noteId: string) => {
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;

      confirmDelete({
        label: t("deleted.toast"),
        undoLabel: t("deleted.undo"),
        onRemove: () => {
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
        },
        onConfirm: async () => {
          const result = await deleteNoteAction(projectId, noteId);
          if (!result.success) {
            // Re-insert note on server failure
            setNotes((prev) => [...prev, target]);
            toast.error(t("errors.deleteFailed"));
          }
        },
        onError: () => {
          setNotes((prev) => [...prev, target]);
          toast.error(t("errors.deleteFailed"));
        },
      });
    },
    [notes, projectId, t]
  );

  async function handleAddSubmit() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    if (!newDueDate) return;

    setIsAdding(true);
    const tempId = makeTempId();
    const tempNote = makeTempNote(projectId, tempId, trimmed, newDueDate, newLeadTime);

    // Optimistic insert
    setNotes((prev) => [...prev, tempNote]);
    setEditingId(null);
    setNewTitle("");
    setNewDueDate(todayISODate());
    setNewLeadTime(0);

    const result = await createNoteAction(projectId, {
      title: trimmed,
      due_date: newDueDate,
      lead_time_minutes: newLeadTime,
    });

    if (result.success) {
      // Replace temp with real note
      setNotes((prev) => prev.map((n) => (n.id === tempId ? result.note : n)));
    } else {
      // Remove temp
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      toast.error(t("errors.saveFailed"));
    }
    setIsAdding(false);
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAddSubmit();
    }
    if (e.key === "Escape") {
      setEditingId(null);
      setNewTitle("");
      setNewDueDate(todayISODate());
      setNewLeadTime(0);
    }
  }

  const isAddRowOpen = editingId === "new";

  return (
    <div className="space-y-6">
      {/* Add note inline row */}
      <section>
        {!isAddRowOpen ? (
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="flex items-center gap-2 text-sm font-medium rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <PlusCircle className="h-4 w-4" />
            {t("addButton")}
          </button>
        ) : (
          <div
            className="rounded-md border px-3 py-3 space-y-2 shadow-sm"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              disabled={isAdding}
              placeholder={t("placeholderTitle")}
              aria-label={t("placeholderTitle")}
              className="w-full rounded border-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                onKeyDown={handleAddKeyDown}
                disabled={isAdding}
                aria-label={t("dueLabel")}
                className="rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleAddSubmit()}
                disabled={isAdding || !newTitle.trim()}
                className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {isAdding ? "…" : t("actions.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setNewTitle("");
                  setNewDueDate(todayISODate());
                  setNewLeadTime(0);
                }}
                disabled={isAdding}
                className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Empty state */}
      {notes.length === 0 && !isAddRowOpen && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {t("empty.title")}
          </p>
        </div>
      )}

      {/* Buckets */}
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket} className="space-y-1">
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t(`groups.${bucket}`)}
            </h2>
            {items.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isEditing={editingId === note.id}
                onStartEdit={() => setEditingId(note.id)}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
                onDelete={(id) => handleDelete(id)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
