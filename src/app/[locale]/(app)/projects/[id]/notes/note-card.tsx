"use client";

/**
 * NoteCard — read view for a single note in the masonry grid.
 * Shows done checkbox, category tag, Fraunces title, clamped body, "Added {date}" footer.
 * Hover → edit/delete actions visible.
 * Click → switches to inline NoteEditor.
 */

import { useState } from "react";
import { Pencil, Trash2, Clock, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CATEGORY_MAP } from "@/lib/notes/categories";
import { calendarDaysFromToday } from "@/lib/utils/local-day";
import { useHydrated } from "@/hooks/use-hydrated";
import { NoteEditor } from "./note-editor";
import type { Note } from "@/lib/api/notes";
import type { NoteSavePayload } from "./note-editor";

interface NoteCardProps {
  note: Note;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (noteId: string, payload: NoteSavePayload) => Promise<void>;
  onCancel: () => void;
  onDelete: (noteId: string) => void;
  onToggleDone: (noteId: string) => void;
  /** Write rights: without them the card is read-only (no edit/delete/done). */
  canEdit: boolean;
}

/** The "Added …" footer: today / yesterday, else the date in the app locale
 * (one message per case, so each language can phrase and agree it). Days are
 * the viewer's local calendar days, not UTC ones. */
function createdLabel(
  iso: string,
  locale: string,
  t: (key: string, values?: Record<string, string>) => string
): string {
  const created = new Date(iso);
  const days = calendarDaysFromToday(created);
  if (days === 0) return t("addedToday");
  if (days === -1) return t("addedYesterday");
  // The year only when it is not this one, so last year's 9 Oct is not read as this year's.
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (created.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return t("addedOn", { date: created.toLocaleDateString(locale, opts) });
}

export function NoteCard({
  note,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onToggleDone,
  canEdit,
}: NoteCardProps) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const [isSaving, setIsSaving] = useState(false);
  // The footer depends on the browser's time zone, which the server lacks.
  const hydrated = useHydrated();

  const cat = CATEGORY_MAP[note.category] ?? CATEGORY_MAP.general;
  const isDone = note.status === "done";

  if (isEditing && canEdit) {
    return (
      <div className="grid-item">
        <NoteEditor
          note={note}
          isSaving={isSaving}
          onSave={async (payload) => {
            setIsSaving(true);
            try {
              await onSave(note.id, payload);
            } finally {
              setIsSaving(false);
            }
          }}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </div>
    );
  }

  return (
    <div className="grid-item">
      <article
        className={"note-card" + (isDone ? " done" : "") + (canEdit ? "" : " read-only")}
        onClick={(e) => {
          if (!canEdit) return;
          if (!(e.target as Element).closest(".nc-actions")) onStartEdit();
        }}
      >
        <div className="nc-head">
          {canEdit ? (
            <button
              type="button"
              className={"check" + (isDone ? " checked" : "")}
              aria-label={isDone ? t("markOpen") : t("markDone")}
              onClick={(e) => { e.stopPropagation(); onToggleDone(note.id); }}
            >
              {isDone && <Check size={12} strokeWidth={3} />}
            </button>
          ) : (
            <span
              className={"check" + (isDone ? " checked" : "")}
              aria-hidden
            >
              {isDone && <Check size={12} strokeWidth={3} />}
            </span>
          )}
          <span className="nc-tag">
            <span className="cat-dot" style={{ background: cat.dotColor }} />
            {t(`categories.${cat.id}`)}
          </span>
          {canEdit && (
            <div className="nc-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={onStartEdit}
                aria-label={t("actions.edit")}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                aria-label={t("actions.delete")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <h3 className="nc-title font-display">{note.title}</h3>
        {note.description && (
          <p className="nc-body">{note.description}</p>
        )}
        <div className="nc-foot">
          <Clock size={12} />
          <span className="num">{hydrated ? createdLabel(note.created_at, locale, t) : null}</span>
        </div>
      </article>
    </div>
  );
}
