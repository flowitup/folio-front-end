"use client";

/**
 * NotesToolbar — filter chips + search field row above the masonry grid.
 * Extracted from NotesView to keep file sizes under 200 lines.
 */

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilterChips } from "./filter-chips";
import type { ActiveCat } from "./filter-chips";
import type { NoteCategory } from "@/lib/api/notes";

interface NotesToolbarProps {
  counts: Record<NoteCategory, number>;
  activeCat: ActiveCat;
  onPickCat: (cat: ActiveCat) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

export function NotesToolbar({
  counts,
  activeCat,
  onPickCat,
  query,
  onQueryChange,
}: NotesToolbarProps) {
  const t = useTranslations("notes");

  return (
    <div className="notes-toolbar">
      <FilterChips counts={counts} active={activeCat} onPick={onPickCat} />
      <label className="search-field">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => onQueryChange("")}
            aria-label={t("search.clear")}
          >
            <X size={13} />
          </button>
        )}
      </label>
    </div>
  );
}
