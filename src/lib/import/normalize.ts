/**
 * Value normalisers shared by the billing and library importers.
 *
 * Import files come from spreadsheets as often as from other software, so
 * amounts may carry French formatting ("1 234,50 €") and dates may be written
 * day-first ("27/09/2026"). These helpers turn such cells into the exact
 * strings the API accepts (Decimal strings, ISO dates) or report them as
 * unusable by returning null; they never guess beyond an unambiguous reading.
 */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Decimal cell → canonical decimal string ("1234.5"), or null when the cell
 * is empty or not a number. Numbers are stringified as-is so a JSON value is
 * never pushed through float arithmetic.
 */
export function normalizeDecimal(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== "string") return null;
  let s = value.replace(/[\s  €%]/g, "");
  if (s === "") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators present: the right-most one is the decimal mark.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    if (s.indexOf(",") !== lastComma) return null; // "1,234,5" is ambiguous
    s = s.replace(",", ".");
  }
  return DECIMAL_RE.test(s) ? s : null;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Order of the day and month in a short date such as 03/04/2025. */
export type DateOrder = "dmy" | "mdy";

const SHORT_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** The two leading numbers and the year of a short date, or null. */
function shortDateParts(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const m = SHORT_DATE_RE.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True for a short date whose day and month could be swapped (03/04/2025). */
export function isAmbiguousDate(value: unknown): boolean {
  const parts = shortDateParts(value);
  return parts !== null && parts[0] <= 12 && parts[1] <= 12 && parts[0] !== parts[1];
}

/**
 * The order the short dates of one file follow, read from the dates
 * themselves: a leading number above 12 can only be a day (day-first), a
 * second number above 12 can only be a day too (month-first). "mixed" when
 * the file has both, null when no date settles it.
 */
export function detectDateOrder(values: unknown[]): DateOrder | "mixed" | null {
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    const parts = shortDateParts(value);
    if (!parts) continue;
    if (parts[0] > 12) dayFirst = true;
    if (parts[1] > 12) monthFirst = true;
  }
  if (dayFirst && monthFirst) return "mixed";
  if (dayFirst) return "dmy";
  if (monthFirst) return "mdy";
  return null;
}

/**
 * Date cell → "YYYY-MM-DD", or null when absent or unreadable. Accepts ISO
 * dates (a trailing time part is dropped) and short dates separated by "/",
 * "-" or "." read in `order`: day-first by default, as written in France and
 * Vietnam. With a null order only the short dates that cannot be misread are
 * accepted (a number above 12, or the same day and month); the others give
 * null, see isAmbiguousDate.
 */
export function normalizeIsoDate(value: unknown, order: DateOrder | null = "dmy"): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  const parts = shortDateParts(s);
  if (!parts) return null;
  const [first, second, y] = parts;
  const resolved: DateOrder | null =
    order ?? (first > 12 || first === second ? "dmy" : second > 12 ? "mdy" : null);
  if (!resolved) return null;
  const [d, m] = resolved === "dmy" ? [first, second] : [second, first];
  return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** True for an ISO 8601 date or date-time string the API can parse as a datetime. */
export function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && ISO_DATETIME_RE.test(value.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * Loose e-mail check run before sending: catches the cells the API's e-mail
 * validation would refuse most often (no "@", no domain, spaces, a name
 * around the address). The API still has the last word.
 */
export function isPlausibleEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/** Trimmed non-empty string, or null (numbers are accepted and stringified). */
export function cleanText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s === "" ? null : s;
}
