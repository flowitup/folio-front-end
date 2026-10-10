/**
 * Parse an amount typed by a user in any of the app's locales.
 *
 * French and Vietnamese users write "12 500,75" or "12.500,75"; English users
 * write "12,500.75" or "12500.75". parseFloat would silently stop at the first
 * space or comma ("12 500,75" -> 12), so money inputs go through this instead.
 *
 * Rules:
 * - regular spaces, no-break spaces (U+00A0) and narrow no-break spaces
 *   (U+202F) are digit grouping and are dropped, as is a trailing "€";
 * - when both "," and "." appear, the right-most one is the decimal mark and
 *   the other is grouping;
 * - a single "," or "." is the decimal mark; several of them are grouping;
 * - at most two decimals, so an ambiguous "12,500" or "12.500" is rejected
 *   rather than guessed; letters or a minus sign are invalid too.
 *
 * Options widen this for other figures: `maxDecimals` (a quantity or a unit
 * price carries more than cents, so "2,375" reads as 2.375 there) and
 * `allowNegative` (a leading "-", e.g. a return's credit line).
 *
 * Returns the amount, or null when the text is empty or not a valid amount.
 */
const GROUPED_RE = /^\d{1,3}(?:[.,]\d{3})+$/;

export interface ParseMoneyInputOptions {
  /** Most decimals accepted; default 2 (cents). */
  maxDecimals?: number;
  /** Accept a leading minus sign; default false. */
  allowNegative?: boolean;
}

export function parseMoneyInput(
  raw: string,
  { maxDecimals = 2, allowNegative = false }: ParseMoneyInputOptions = {}
): number | null {
  let s = raw.replace(/[\s  €]/g, "");
  let sign = 1;
  if (allowNegative && /^[-−]/.test(s)) {
    sign = -1;
    s = s.slice(1);
  }
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const [intPart, decPart, ...rest] = s.split(decimal);
    if (rest.length > 0 || !GROUPED_RE.test(intPart)) return null;
    s = `${intPart.split(grouping).join("")}.${decPart}`;
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    if (s.indexOf(sep) !== s.lastIndexOf(sep)) {
      // "1.234.567" / "1,234,567": only digit grouping, never a decimal.
      if (!GROUPED_RE.test(s)) return null;
      s = s.split(sep).join("");
    } else {
      s = s.replace(sep, ".");
    }
  }

  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? sign * value : null;
}
