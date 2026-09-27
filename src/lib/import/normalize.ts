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

/**
 * Date cell → "YYYY-MM-DD", or null when absent or unreadable. Accepts ISO
 * dates (a trailing time part is dropped) and day-first dates separated by
 * "/", "-" or "." as written in France and Vietnam.
 */
export function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dayFirst) {
    const [d, m, y] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
    return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }
  return null;
}

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** True for an ISO 8601 date or date-time string the API can parse as a datetime. */
export function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && ISO_DATETIME_RE.test(value.trim());
}

/** Trimmed non-empty string, or null (numbers are accepted and stringified). */
export function cleanText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s === "" ? null : s;
}
