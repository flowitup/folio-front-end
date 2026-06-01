/**
 * Calendar grid helpers for the labor month view (Phase 2 of the labor
 * UX overhaul). Pure functions over Date objects — no timezone tricks,
 * no Intl side effects beyond formatting.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2a).
 */

/**
 * Parse an `YYYY-MM` month tag into the first-of-month Date in local
 * time. Returns null on malformed input so callers can fall back to
 * today's month gracefully.
 */
export function parseMonthTag(month: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1; // 0-based
  if (monthIdx < 0 || monthIdx > 11) return null;
  return new Date(year, monthIdx, 1);
}

/**
 * Serialize a Date back to `YYYY-MM`. Pairs with parseMonthTag.
 */
export function formatMonthTag(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Return the number of days in the given month (1..31). Handles leap
 * years correctly because JS Date rolls over: day 0 of the next month
 * resolves to the last day of the current month.
 */
function daysInMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/**
 * Day-of-week of the first of the month, normalized to Monday-first
 * (0 = Monday, 6 = Sunday). The labor calendar starts weeks on Monday
 * because that's the French construction-week convention; downstream
 * cell rendering uses this offset as the left-padding count.
 */
function firstWeekdayOffset(year: number, monthIdx: number): number {
  // getDay(): 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const sundayBased = new Date(year, monthIdx, 1).getDay();
  return (sundayBased + 6) % 7;
}

/**
 * Total cell count for a month grid laid out Monday-first: leading
 * empty cells before day 1 + the days themselves + trailing empties
 * to fill the last week. Always a multiple of 7. Used by the
 * CalendarMonthGrid renderer to size its CSS grid.
 */
function monthGridCellCount(year: number, monthIdx: number): number {
  const offset = firstWeekdayOffset(year, monthIdx);
  const days = daysInMonth(year, monthIdx);
  const filled = offset + days;
  return Math.ceil(filled / 7) * 7;
}

/**
 * Build an array of Date | null values for the month grid. Leading
 * nulls represent the empty cells before day 1; trailing nulls fill
 * the last week.
 */
export function buildMonthGrid(year: number, monthIdx: number): (Date | null)[] {
  const offset = firstWeekdayOffset(year, monthIdx);
  const days = daysInMonth(year, monthIdx);
  const totalCells = monthGridCellCount(year, monthIdx);
  const cells: (Date | null)[] = new Array(totalCells).fill(null);
  for (let d = 1; d <= days; d++) {
    cells[offset + d - 1] = new Date(year, monthIdx, d);
  }
  return cells;
}

/**
 * True when the given Date matches today (local time, day-precision).
 * Pure read of the system clock — safe for SSR because the calling
 * cell component renders client-side only.
 */
export function isToday(d: Date): boolean {
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/**
 * `YYYY-MM-DD` (UTC-independent — local-time fields). Matches the
 * shape LaborEntry.date returns from the backend, so this is the key
 * we group entries by in the calendar.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Localized month label for the header — "Mai 2026" in French,
 * "May 2026" in English. The locale is provided by the caller so the
 * helper stays SSR-safe.
 */
export function monthLabel(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
