/**
 * Pure helpers: group notes by created-date proximity or category.
 * No side-effects; safe to unit-test without timers (inject today).
 */

import type { Note } from "@/lib/api/notes";
import { CATEGORY_ORDER, CATEGORY_MAP } from "@/lib/notes/categories";

// ---- Types ----

export interface NoteSection {
  key: string;
  /** i18n key for the section heading */
  labelKey: string;
  /** Optional dot color (set for category grouping) */
  dotColor?: string;
  items: Note[];
}

export type GroupingMode = "date" | "category";

// Created-date bucket keys in display order
const CREATED_BUCKET_ORDER = ["today", "yesterday", "week", "earlier"] as const;
type CreatedBucket = (typeof CREATED_BUCKET_ORDER)[number];

const CREATED_LABEL_KEYS: Record<CreatedBucket, string> = {
  today:     "notes.groups.today",
  yesterday: "notes.groups.yesterday",
  week:      "notes.groups.week",
  earlier:   "notes.groups.earlier",
};

// ---- Date helpers ----

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Map an ISO timestamp to a created-date bucket relative to today (UTC).
 * - today:     created_at date == today
 * - yesterday: created_at date == yesterday
 * - week:      created_at date within last 7 days (excl. today and yesterday)
 * - earlier:   anything older
 */
export function createdBucket(iso: string, today: Date = new Date()): CreatedBucket {
  const createdKey = iso.slice(0, 10); // fast YYYY-MM-DD extraction
  const todayKey = toDateKey(today);

  if (createdKey === todayKey) return "today";

  const yesterdayDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1)
  );
  const yesterdayKey = toDateKey(yesterdayDate);

  if (createdKey === yesterdayKey) return "yesterday";

  // "week" = last 7 calendar days, excluding today and yesterday
  const weekAgoDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7)
  );
  const weekAgoKey = toDateKey(weekAgoDate);

  if (createdKey >= weekAgoKey && createdKey < yesterdayKey) return "week";

  return "earlier";
}

// ---- Section builder ----

const byCreatedDesc = (a: Note, b: Note) => b.created_at.localeCompare(a.created_at);

/**
 * Build ordered display sections from a flat note list.
 *
 * - grouping="date": sections = today | yesterday | week | earlier
 * - grouping="category": sections = one per category (ordered by CATEGORY_ORDER)
 *
 * Items within each section are sorted created_at DESC.
 * Empty sections are omitted.
 *
 * @param notes - flat array of Note objects (already filtered by caller if needed)
 * @param grouping - "date" | "category"
 * @param today - reference date for date grouping (default: new Date())
 */
export function buildSections(
  notes: Note[],
  grouping: GroupingMode = "date",
  today: Date = new Date()
): NoteSection[] {
  if (grouping === "category") {
    return CATEGORY_ORDER
      .map((catId): NoteSection => {
        const meta = CATEGORY_MAP[catId];
        const items = notes.filter((n) => n.category === catId).sort(byCreatedDesc);
        return {
          key: catId,
          labelKey: meta.i18nKey,
          dotColor: meta.dotColor,
          items,
        };
      })
      .filter((s) => s.items.length > 0);
  }

  // grouping === "date"
  const map: Record<CreatedBucket, Note[]> = {
    today: [],
    yesterday: [],
    week: [],
    earlier: [],
  };

  for (const note of notes) {
    const bucket = createdBucket(note.created_at, today);
    map[bucket].push(note);
  }

  return CREATED_BUCKET_ORDER
    .map((key): NoteSection => ({
      key,
      labelKey: CREATED_LABEL_KEYS[key],
      items: map[key].sort(byCreatedDesc),
    }))
    .filter((s) => s.items.length > 0);
}
