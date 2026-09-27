/**
 * Calendar days as the business sees them.
 *
 * Folio's users work in France, so "today" and "the day a photo was taken"
 * are Europe/Paris days. Slicing an ISO timestamp (`toISOString().slice(0, 10)`)
 * gives the UTC day instead, which is yesterday between 00:00 and 02:00 in
 * Paris; formatting in the runtime's own zone makes the server (UTC) and the
 * browser disagree. These helpers pin both to Paris.
 */

export const BUSINESS_TIME_ZONE = "Europe/Paris";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of the Paris calendar day containing `date` (default: now). */
export function parisDayKey(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dayFormatter.format(d);
}

/** YYYY-MM-DD `days` calendar days after the YYYY-MM-DD `day`. */
export function addDaysToDayKey(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * A Date for a YYYY-MM-DD day, to format with `timeZone: "UTC"` so the day
 * shown is the day given, whatever zone the code runs in.
 */
export function dayKeyToUtcNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}
