"use client";

/**
 * NoteStatusToggle — checkbox that calls markDone / markOpen server action.
 * Optimistic: checkbox flips immediately; rolls back on server error.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { markNoteDoneAction, markNoteOpenAction } from "./actions";
import type { Note } from "@/lib/api/notes";

interface NoteStatusToggleProps {
  note: Note;
  onStatusChange: (updated: Note) => void;
  disabled?: boolean;
}

export function NoteStatusToggle({
  note,
  onStatusChange,
  disabled = false,
}: NoteStatusToggleProps) {
  const t = useTranslations("notes");
  const [isPending, setIsPending] = useState(false);
  const isDone = note.status === "done";

  async function handleChange() {
    if (isPending || disabled) return;

    // Optimistic flip
    const optimistic: Note = { ...note, status: isDone ? "open" : "done" };
    onStatusChange(optimistic);
    setIsPending(true);

    try {
      const result = isDone
        ? await markNoteOpenAction(note.project_id, note.id)
        : await markNoteDoneAction(note.project_id, note.id);

      if (result.success) {
        onStatusChange(result.note);
      } else {
        // Rollback
        onStatusChange(note);
        toast.error(t("errors.generic"));
      }
    } catch {
      // Rollback on unexpected error
      onStatusChange(note);
      toast.error(t("errors.generic"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <input
      type="checkbox"
      checked={isDone}
      onChange={handleChange}
      disabled={isPending || disabled}
      aria-label={isDone ? t("statusOpen") : t("statusDone")}
      className="h-4 w-4 rounded border accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
    />
  );
}
