/**
 * Pure helpers: group notes by created-date proximity or category.
 * No side-effects; safe to unit-test without timers (inject today).
 */

import type { Note } from "@/lib/api/notes";
import { CATEGORY_ORDER, CATEGORY_MAP } from "@/lib/notes/categories";
import { startOfWeekMonday } from "@/lib/planning/week";

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

/** `YYYY-MM-DD` of the local calendar day (the viewer's time zone, never UTC). */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Map an ISO timestamp to a created-date bucket relative to today, on the
 * viewer's local calendar (a note written at 00:30 in Paris is still the
 * previous day in UTC):
 * - today:     created on today's local date
 * - yesterday: created on yesterday's local date
 * - week:      created earlier this calendar week (Monday onwards), before yesterday
 * - earlier:   anything older
 */
export function createdBucket(iso: string, today: Date = new Date()): CreatedBucket {
  const createdKey = toDateKey(new Date(iso));
  const todayKey = toDateKey(today);

  if (createdKey === todayKey) return "today";

  const yesterdayKey = toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  );

  if (createdKey === yesterdayKey) return "yesterday";

  // "Earlier this week" = since this week's Monday, excluding today and yesterday
  const weekStartKey = toDateKey(startOfWeekMonday(today));

  if (createdKey >= weekStartKey && createdKey < yesterdayKey) return "week";

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
