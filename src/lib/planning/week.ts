// Pure, locale-independent Monday→Sunday week math for the planning week view.
// No framework imports. All operations are on LOCAL calendar dates so a
// `due_date` string (YYYY-MM-DD) lands on its own calendar day with no UTC drift.

/**
 * Local-date key `YYYY-MM-DD`. Built from local getters (NOT `toISOString`,
 * which would shift the day for users east/west of UTC).
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight of the Monday on or before `d`. */
export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0=Sun..6=Sat. Days to step back to reach Monday.
  const back = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - back);
  return out;
}

/** Add `n` whole weeks (n may be negative). Returns a new local-midnight date. */
export function addWeeks(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n * 7);
  return out;
}

/** The 7 local-midnight dates Mon→Sun for the week starting at `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Human week-range label, e.g. `Jun 1 – 7, 2026` (same month) or
 * `May 25 – Jun 7, 2026` (cross-month). Year shown once; month repeats only
 * when the week spans two months.
 *
 * Built manually rather than via a single `Intl` call with a partial option
 * set — `Intl.DateTimeFormat(locale, { day, year })` (month omitted) yields
 * garbled output like `2026 (day: 7)` in some engines/locales. We only lean on
 * `Intl` for the localized month name, which is well-defined.
 */
export function formatWeekRange(weekStart: Date, locale: string): string {
  const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const startMonth = monthFmt.format(weekStart);
  const sameMonth =
    weekStart.getMonth() === end.getMonth() && weekStart.getFullYear() === end.getFullYear();
  const year = end.getFullYear();
  if (sameMonth) {
    return `${startMonth} ${weekStart.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${monthFmt.format(end)} ${end.getDate()}, ${year}`;
}

/** Safe parse of a `?week=` query param into an integer offset (default 0). */
export function weekOffsetFromParam(param: string | null): number {
  if (!param) return 0;
  const n = Number.parseInt(param, 10);
  return Number.isFinite(n) ? n : 0;
}
