/**
 * French public holidays (jours fériés) for any given year.
 *
 * Combines fixed-date holidays with movable feasts derived from Easter.
 * Returns the holiday's French name when the given date is a public holiday,
 * or null otherwise.
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

export function getFrenchHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const pentecostMonday = addDays(easter, 50);

  const fixed: Array<[number, number, string]> = [
    [0, 1, "Jour de l'An"],
    [4, 1, "Fête du Travail"],
    [4, 8, "Victoire 1945"],
    [6, 14, "Fête Nationale"],
    [7, 15, "Assomption"],
    [10, 1, "Toussaint"],
    [10, 11, "Armistice 1918"],
    [11, 25, "Noël"],
  ];

  const holidays = new Map<string, string>();
  for (const [m, d, name] of fixed) {
    holidays.set(dateKey(new Date(year, m, d)), name);
  }
  holidays.set(dateKey(easterMonday), "Lundi de Pâques");
  holidays.set(dateKey(ascension), "Ascension");
  holidays.set(dateKey(pentecostMonday), "Lundi de Pentecôte");
  return holidays;
}

const cache = new Map<number, Map<string, string>>();

export function getFrenchHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  let yearMap = cache.get(year);
  if (!yearMap) {
    yearMap = getFrenchHolidays(year);
    cache.set(year, yearMap);
  }
  return yearMap.get(dateKey(date)) ?? null;
}
