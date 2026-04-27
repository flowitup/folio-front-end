/**
 * Pure helper: group notes by due-date proximity relative to today (UTC).
 * Returns 5 named buckets used by the agenda view.
 * No side-effects; safe to unit-test without timers.
 */

import type { Note } from "@/lib/api/notes";

export interface GroupedNotes {
  today: Note[];
  tomorrow: Note[];
  thisWeek: Note[];
  later: Note[];
  done: Note[];
}

/**
 * Converts a YYYY-MM-DD string to a comparable date key string (ISO date part).
 * Always treat due_date as a calendar date, no timezone conversion.
 */
function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Group notes into agenda buckets based on due_date (UTC) and status.
 *
 * Bucket rules (for `status === "open"` notes):
 *   - today    : due_date == todayKey
 *   - tomorrow : due_date == tomorrowKey
 *   - thisWeek : due_date within next 7 calendar days (excl. today and tomorrow)
 *   - later    : due_date beyond next 7 days OR no due_date match
 *
 * `done` bucket: all notes with `status === "done"`, sorted newest first.
 *
 * @param notes - flat array of Note objects
 * @param today - reference date (default: new Date())
 */
export function groupNotesByDay(notes: Note[], today: Date = new Date()): GroupedNotes {
  const todayKey = toDateKey(today);

  const tomorrowDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)
  );
  const tomorrowKey = toDateKey(tomorrowDate);

  // "This week" = today+2 through today+7 (inclusive)
  const weekStartDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2)
  );
  const weekEndDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7)
  );
  const weekStartKey = toDateKey(weekStartDate);
  const weekEndKey = toDateKey(weekEndDate);

  const result: GroupedNotes = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    done: [],
  };

  for (const note of notes) {
    if (note.status === "done") {
      result.done.push(note);
      continue;
    }

    const dueKey = note.due_date; // already YYYY-MM-DD from backend

    if (dueKey === todayKey) {
      result.today.push(note);
    } else if (dueKey === tomorrowKey) {
      result.tomorrow.push(note);
    } else if (dueKey >= weekStartKey && dueKey <= weekEndKey) {
      result.thisWeek.push(note);
    } else {
      result.later.push(note);
    }
  }

  // Re-sort within each bucket even though BE returns notes ordered by due_date ASC
  // (from ListProjectNotesUseCase). This is intentional: open buckets sort by due_date
  // ascending, while the done bucket sorts by recency — different orders per bucket.
  const byDue = (a: Note, b: Note) => a.due_date.localeCompare(b.due_date);
  result.today.sort(byDue);
  result.tomorrow.sort(byDue);
  result.thisWeek.sort(byDue);
  result.later.sort(byDue);

  // Sort done by updated_at descending (most recently completed first)
  result.done.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return result;
}
