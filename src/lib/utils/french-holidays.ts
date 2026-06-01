/**
 * French public holidays (jours fériés) for any given year.
 *
 * Combines fixed-date holidays with movable feasts derived from Easter.
 * Returns a stable translation key when the given date is a public
 * holiday, or null otherwise. Callers resolve the key via next-intl
 * (labor.holidays.*) so the display follows the user's chosen locale.
 *
 * Easter date uses Gauss's algorithm (Anonymous Gregorian / Meeus form).
 */

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm for Western Easter.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stable translation keys under `labor.holidays.*` in messages/*.json. */
export type FrenchHolidayKey =
  | "newYear"
  | "labourDay"
  | "victory1945"
  | "bastilleDay"
  | "assumption"
  | "allSaints"
  | "armistice1918"
  | "christmas"
  | "easterMonday"
  | "ascension"
  | "pentecostMonday";

function getFrenchHolidays(year: number): Map<string, FrenchHolidayKey> {
  const easter = easterSunday(year);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const pentecostMonday = addDays(easter, 50);

  const fixed: Array<[number, number, FrenchHolidayKey]> = [
    [0, 1, "newYear"],
    [4, 1, "labourDay"],
    [4, 8, "victory1945"],
    [6, 14, "bastilleDay"],
    [7, 15, "assumption"],
    [10, 1, "allSaints"],
    [10, 11, "armistice1918"],
    [11, 25, "christmas"],
  ];

  const holidays = new Map<string, FrenchHolidayKey>();
  for (const [m, d, key] of fixed) {
    holidays.set(dateKey(new Date(year, m, d)), key);
  }
  holidays.set(dateKey(easterMonday), "easterMonday");
  holidays.set(dateKey(ascension), "ascension");
  holidays.set(dateKey(pentecostMonday), "pentecostMonday");
  return holidays;
}

const cache = new Map<number, Map<string, FrenchHolidayKey>>();

export function getFrenchHolidayKey(date: Date): FrenchHolidayKey | null {
  const year = date.getFullYear();
  let yearMap = cache.get(year);
  if (!yearMap) {
    yearMap = getFrenchHolidays(year);
    cache.set(year, yearMap);
  }
  return yearMap.get(dateKey(date)) ?? null;
}
