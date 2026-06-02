"use client";

/**
 * NoteCard — read view for a single note in the masonry grid.
 * Shows category tag, Fraunces title, clamped body, "Added {date}" footer.
 * Hover → edit/delete actions visible.
 * Click → switches to inline NoteEditor.
 * Ports the artifact's NoteCard component.
 */

import { useState } from "react";
import { Pencil, Trash2, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { CATEGORY_MAP } from "@/lib/notes/categories";
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
}

/** Format created_at ISO for the "Added …" footer label */
function createdLabel(iso: string, t: (key: string) => string): string {
  const createdDate = iso.slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (createdDate === todayDate) return t("relative.today");
  if (createdDate === yesterdayDate) return t("relative.yesterday");
  // Format as "Jun 10"
  const d = new Date(`${createdDate}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NoteCard({
  note,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: NoteCardProps) {
  const t = useTranslations("notes");
  const [isSaving, setIsSaving] = useState(false);

  const cat = CATEGORY_MAP[note.category] ?? CATEGORY_MAP.general;

  if (isEditing) {
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
        className="note-card"
        onClick={(e) => {
          if (!(e.target as Element).closest(".nc-actions")) onStartEdit();
        }}
      >
        <div className="nc-head">
          <span className="nc-tag">
            <span className="cat-dot" style={{ background: cat.dotColor }} />
            {t(`categories.${cat.id}`)}
          </span>
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
        </div>

        <h3 className="nc-title font-display">{note.title}</h3>
        {note.description && (
          <p className="nc-body">{note.description}</p>
        )}
        <div className="nc-foot">
          <Clock size={12} />
          <span className="num">{t("addedLabel")} {createdLabel(note.created_at, t)}</span>
        </div>
      </article>
    </div>
  );
}
