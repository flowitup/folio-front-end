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
 * Human week-range label in the locale's own order: `Jun 1 – 7, 2026` (en),
 * `1–7 juin 2026` (fr), `1 – 7 thg 6, 2026` (vi). The shared month and year
 * are collapsed by `Intl.DateTimeFormat#formatRange`; giving it day, month and
 * year avoids the partial-option garbling (`2026 (day: 7)`) some engines
 * produce. Thin/narrow spaces are normalised to plain ones.
 */
export function formatWeekRange(weekStart: Date, locale: string): string {
  const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  return fmt.formatRange(weekStart, end).replace(/[\u2009\u202f]/g, " ");
}

/** Safe parse of a `?week=` query param into an integer offset (default 0). */
export function weekOffsetFromParam(param: string | null): number {
  if (!param) return 0;
  const n = Number.parseInt(param, 10);
  return Number.isFinite(n) ? n : 0;
}
