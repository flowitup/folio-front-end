"use client";

/**
 * NotesView — top-level client orchestrator for the journal notes wall.
 * Manages: filter/search state, grouped masonry render.
 * Optimistic CRUD delegated to useNotesState hook.
 */

import { useState } from "react";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { buildSections } from "@/lib/notes/grouping";
import { CATEGORY_ORDER } from "@/lib/notes/categories";
import { QuickAdd } from "./quick-add";
import { NotesToolbar } from "./notes-toolbar";
import { NoteCard } from "./note-card";
import { useNotesState } from "./use-notes-state";
import type { Note, NoteCategory } from "@/lib/api/notes";
import type { ActiveCat } from "./filter-chips";

interface NotesViewProps {
  projectId: string;
  initialNotes: Note[];
}

export function NotesView({ projectId, initialNotes }: NotesViewProps) {
  const t = useTranslations("notes");
  const { notes, editingId, setEditingId, handleAdd, handleSave, handleDelete, handleToggleDone } =
    useNotesState(projectId, initialNotes);

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
                  onToggleDone={handleToggleDone}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
