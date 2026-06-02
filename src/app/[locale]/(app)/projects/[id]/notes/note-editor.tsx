"use client";

/**
 * NoteEditor — inline editor for a saved note (title, body, category).
 * Cmd/Ctrl+Enter = save; Esc = cancel.
 * Ports the artifact's NoteEditor component.
 * Includes the onBlur relatedTarget guard to prevent race on focus-move.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryMenu } from "./category-menu";
import type { Note, NoteCategory } from "@/lib/api/notes";

export interface NoteSavePayload {
  title: string;
  description: string | null;
  category: NoteCategory;
}

interface NoteEditorProps {
  note: Note;
  onSave: (payload: NoteSavePayload) => Promise<void>;
  onCancel: () => void;
  onDelete: (noteId: string) => void;
  isSaving?: boolean;
}

export function NoteEditor({ note, onSave, onCancel, onDelete, isSaving = false }: NoteEditorProps) {
  const t = useTranslations("notes");
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description ?? "");
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  // Note: local state is intentionally initialized from props only once on mount.
  // The parent unmounts/remounts this editor (via key prop) on rollback, so no
  // sync effect is needed — avoids cascading render lint warning.

  const save = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) { onCancel(); return; }
    await onSave({ title: trimmed, description: description.trim() || null, category });
  }, [title, description, category, onSave, onCancel]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  }

  function handleBlur(e: React.FocusEvent) {
    // Skip save if focus moved to another element inside the editor container
    const related = e.relatedTarget as Node | null;
    if (containerRef.current && related && containerRef.current.contains(related)) return;
    // Skip if focus moved to a popover portal outside the container (category menu)
    if (related && (related as Element).closest?.('[role="listbox"]')) return;
    void save();
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onCancel(); // exit edit first to avoid onBlur-save race
    onDelete(note.id);
  }

  return (
    <div
      ref={containerRef}
      className="note-editor"
      onKeyDown={onKey}
    >
      <input
        ref={titleRef}
        className="editor-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        placeholder={t("editor.placeholderTitle")}
        aria-label={t("editor.placeholderTitle")}
        disabled={isSaving}
      />
      <textarea
        className="editor-desc"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={handleBlur}
        placeholder={t("editor.placeholderBody")}
        aria-label={t("editor.placeholderBody")}
        rows={4}
        disabled={isSaving}
      />
      <div className="editor-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={isSaving}
          style={{ padding: "8px 16px" }}
        >
          {t("actions.save")}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={onCancel}
          disabled={isSaving}
        >
          {t("actions.cancel")}
        </button>
        <CategoryMenu value={category} onChange={setCategory} disabled={isSaving} />
        <button
          type="button"
          className="icon-btn danger"
          style={{ marginLeft: "auto" }}
          onClick={handleDeleteClick}
          aria-label={t("actions.delete")}
          disabled={isSaving}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
