"use client";

/**
 * FilterChips — "All" chip + one per category that has notes.
 * Ports the artifact's FilterChips component.
 */

import { useTranslations } from "next-intl";
import { NOTE_CATEGORIES, CATEGORY_MAP } from "@/lib/notes/categories";
import type { NoteCategory } from "@/lib/api/notes";
// NoteCategory is used in the counts Record key and ActiveCat union

export type ActiveCat = NoteCategory | "all";

interface FilterChipsProps {
  /** Count per category id */
  counts: Record<NoteCategory, number>;
  active: ActiveCat;
  onPick: (cat: ActiveCat) => void;
}

export function FilterChips({ counts, active, onPick }: FilterChipsProps) {
  const t = useTranslations("notes");
  const total = NOTE_CATEGORIES.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);

  return (
    <div className="filter-chips">
      <button
        type="button"
        className={"chip" + (active === "all" ? " on" : "")}
        onClick={() => onPick("all")}
      >
        {t("filterAll")} <span className="chip-n num">{total}</span>
      </button>

      {NOTE_CATEGORIES.filter((c) => (counts[c.id] ?? 0) > 0).map((c) => {
        const meta = CATEGORY_MAP[c.id];
        return (
          <button
            key={c.id}
            type="button"
            className={"chip" + (active === c.id ? " on" : "")}
            onClick={() => onPick(c.id)}
          >
            <span className="cat-dot" style={{ background: meta.dotColor }} />
            {t(`categories.${c.id}`)} <span className="chip-n num">{counts[c.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
