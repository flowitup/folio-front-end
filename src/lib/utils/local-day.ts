/**
 * Calendar days in the viewer's own time zone.
 *
 * "Added today" or "Updated yesterday" speak about the reader's calendar.
 * Slicing an ISO timestamp gives the UTC day instead (yesterday before 02:00
 * in Paris, before 07:00 in Hanoi), and dividing the elapsed time by 24 h
 * calls a template saved yesterday at 19:00 "today" the next morning.
 * Text built from these depends on the browser's zone, so render it once
 * hydrated (see useHydrated): the server renders in its own zone.
 */

const DAY_MS = 86_400_000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Calendar days from `now`'s local day to `date`'s: 0 today, -1 yesterday,
 * 1 tomorrow. NaN for an invalid date.
 */
export function calendarDaysFromToday(date: Date, now: Date = new Date()): number {
  // Math.round absorbs the 23 h and 25 h days at daylight-saving changes.
  return Math.round((startOfLocalDay(date) - startOfLocalDay(now)) / DAY_MS);
}
