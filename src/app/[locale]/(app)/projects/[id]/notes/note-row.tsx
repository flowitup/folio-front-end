"use client";

/**
 * NoteRow — displays one note in either read or edit mode.
 * - Click title or pencil → edit mode
 * - onBlur (with relatedTarget check) OR Enter → save
 * - Esc → cancel
 * - Trash → exit edit first, then trigger delete
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteStatusToggle } from "./note-status-toggle";
import type { Note, LeadTimeMinutes } from "@/lib/api/notes";

interface SavePayload {
  title: string;
  due_date: string;
  lead_time_minutes: LeadTimeMinutes;
  description: string | null;
}

interface NoteRowProps {
  note: Note;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (noteId: string, payload: SavePayload) => Promise<void>;
  onCancel: () => void;
  onDelete: (noteId: string) => void;
  onStatusChange: (updated: Note) => void;
}

const LEAD_TIME_VALUES = [0, 60, 1440] as const satisfies readonly LeadTimeMinutes[];

export function NoteRow({
  note,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onStatusChange,
}: NoteRowProps) {
  const t = useTranslations("notes");
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(note.title);
  const [dueDate, setDueDate] = useState(note.due_date);
  const [leadTime, setLeadTime] = useState<LeadTimeMinutes>(note.lead_time_minutes);
  const [description, setDescription] = useState(note.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);

  // Sync local state when note prop changes (e.g. optimistic rollback or server update).
  // Also resets expandedDescription when leaving edit mode.
  useEffect(() => {
    if (!isEditing) {
      setTitle(note.title);
      setDueDate(note.due_date);
      setLeadTime(note.lead_time_minutes);
      setDescription(note.description ?? "");
      setExpandedDescription(false);
    }
  }, [note, isEditing]);

  // Autofocus title input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      titleRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(note.id, {
        title: title.trim() || note.title,
        due_date: dueDate,
        lead_time_minutes: leadTime,
        description: description.trim() || null,
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, note.id, note.title, title, dueDate, leadTime, description, onSave]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") {
      onCancel();
      setTitle(note.title);
      setDueDate(note.due_date);
      setLeadTime(note.lead_time_minutes);
      setDescription(note.description ?? "");
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // Skip save if focus moved to another element inside the row container
    const relatedTarget = e.relatedTarget as Node | null;
    if (containerRef.current && relatedTarget && containerRef.current.contains(relatedTarget)) {
      return;
    }
    // Also skip if focus moved to a Select dropdown portal (outside container)
    if (relatedTarget && (relatedTarget as Element).closest?.('[data-slot="select-content"]')) {
      return;
    }
    void handleSave();
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    // Exit edit mode immediately to avoid onBlur-save race
    if (isEditing) onCancel();
    onDelete(note.id);
  }

  if (!isEditing) {
    return (
      <div
        className="group rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
        role="row"
      >
        <div className="flex items-center gap-3">
          <NoteStatusToggle note={note} onStatusChange={onStatusChange} />

          {/* Title — clickable to enter edit */}
          <button
            type="button"
            onClick={onStartEdit}
            className="flex-1 text-left text-sm truncate focus:outline-none focus-visible:underline"
            style={note.status === "done" ? { textDecoration: "line-through", color: "var(--muted-foreground)" } : undefined}
          >
            {note.title}
          </button>

          {/* Due-date chip */}
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {note.due_date}
          </span>

          {/* Lead-time chip */}
          <span
            className="shrink-0 text-xs hidden sm:inline-block"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t(`leadTimeOptions.${note.lead_time_minutes}`)}
          </span>

          {/* Hover actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onStartEdit}
              aria-label={t("actions.edit")}
              className="rounded p-1 hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              aria-label={t("actions.delete")}
              className="rounded p-1 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        </div>

        {/* Description — click to expand/collapse; stopPropagation prevents row-click-to-edit */}
        {note.description && (
          <p
            className={`mt-1 ml-7 text-sm whitespace-pre-wrap cursor-pointer ${expandedDescription ? "" : "line-clamp-2"}`}
            style={{ color: "var(--muted-foreground)" }}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedDescription((v) => !v);
            }}
          >
            {note.description}
          </p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div
      ref={containerRef}
      role="form"
      aria-label={t("actions.edit")}
      className="rounded-md border px-3 py-3 space-y-2 shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Title input */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        placeholder={t("placeholderTitle")}
        aria-label={t("placeholderTitle")}
        className="w-full rounded border-0 bg-transparent text-sm font-medium outline-none focus:ring-0 placeholder:text-muted-foreground"
      />

      {/* Due date + lead time row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          aria-label={t("dueLabel")}
          className="rounded border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />

        <Select
          value={String(leadTime)}
          onValueChange={(v) => setLeadTime(Number(v) as LeadTimeMinutes)}
          disabled={isSaving}
        >
          <SelectTrigger size="sm" className="w-[130px] text-xs" aria-label={t("leadTimeLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_TIME_VALUES.map((val) => (
              <SelectItem key={val} value={String(val)}>
                {t(`leadTimeOptions.${val}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description textarea */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        placeholder={t("placeholderDescription")}
        aria-label={t("placeholderDescription")}
        rows={2}
        className="w-full resize-none rounded border-0 bg-transparent text-xs outline-none focus:ring-0 placeholder:text-muted-foreground"
        style={{ whiteSpace: "pre-wrap" }}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {isSaving ? "…" : t("actions.save")}
        </button>
        <button
          type="button"
          onClick={() => {
            onCancel();
            setTitle(note.title);
            setDueDate(note.due_date);
            setLeadTime(note.lead_time_minutes);
            setDescription(note.description ?? "");
          }}
          disabled={isSaving}
          className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("actions.cancel")}
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isSaving}
          aria-label={t("actions.delete")}
          className="ml-auto rounded p-1 hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
    </div>
  );
}
