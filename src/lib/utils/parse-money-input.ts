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
 * price carries more than cents) and `allowNegative` (a leading "-", e.g. a
 * return's credit line).
 *
 * A single separator followed by exactly three digits ("1,500", "1.340") reads
 * as a thousands group to most fr/vi users and as a decimal to some en users.
 * Even where 3 decimals are allowed it is refused as ambiguous unless the field
 * opts in with `ambiguousGrouping: "decimal"` (a quantity, where "2,375" m³ is
 * normal), so a unit price never silently becomes 1,50 € when 1 500 € was meant.
 *
 * `parseMoneyInput` returns the amount, or null when the text is empty or not a
 * valid amount; `parseMoneyInputDetailed` also says why, so a form can show it.
 */
const GROUPED_RE = /^\d{1,3}(?:[.,]\d{3})+$/;
const AMBIGUOUS_RE = /^[1-9]\d{0,2}[.,]\d{3}$/;

export interface ParseMoneyInputOptions {
  /** Most decimals accepted; default 2 (cents). */
  maxDecimals?: number;
  /** Accept a leading minus sign; default false. */
  allowNegative?: boolean;
  /**
   * How to read "1,500" when 3+ decimals are allowed: "reject" (default)
   * refuses it as ambiguous, "decimal" reads 1.5.
   */
  ambiguousGrouping?: "reject" | "decimal";
}

export type MoneyInputError =
  /** Nothing typed. */
  | "empty"
  /** Not a number at all ("abc", "1.2.3", "1e3"). */
  | "invalid"
  /** "1,500" / "1.340": a thousands group or a decimal? See `suggestion`. */
  | "ambiguous"
  /** More decimals than the field keeps. */
  | "tooManyDecimals"
  /** A minus sign where none is allowed. */
  | "negative";

export interface ParsedMoneyInput {
  value: number | null;
  error: MoneyInputError | null;
  /** For "ambiguous": the amount read as a thousands group (1,500 -> 1500). */
  suggestion?: number;
}

export function parseMoneyInputDetailed(
  raw: string,
  { maxDecimals = 2, allowNegative = false, ambiguousGrouping = "reject" }: ParseMoneyInputOptions = {}
): ParsedMoneyInput {
  let s = raw.replace(/[\s  €]/g, "");
  let sign = 1;
  if (/^[-−]/.test(s)) {
    if (!allowNegative) {
      return { value: null, error: /^[-−]\d/.test(s) ? "negative" : "invalid" };
    }
    sign = -1;
    s = s.slice(1);
  }
  if (s === "") return { value: null, error: sign === -1 ? "invalid" : "empty" };

  // "1,500": a thousands group to most people, 1.5 to a few. Refused unless the
  // field said the 3-decimal reading is the natural one.
  if (AMBIGUOUS_RE.test(s) && !(maxDecimals >= 3 && ambiguousGrouping === "decimal")) {
    return { value: null, error: "ambiguous", suggestion: sign * Number(s.replace(/[.,]/, "")) };
  }

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const [intPart, decPart, ...rest] = s.split(decimal);
    if (rest.length > 0 || !GROUPED_RE.test(intPart)) return { value: null, error: "invalid" };
    s = `${intPart.split(grouping).join("")}.${decPart}`;
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    if (s.indexOf(sep) !== s.lastIndexOf(sep)) {
      // "1.234.567" / "1,234,567": only digit grouping, never a decimal.
      if (!GROUPED_RE.test(s)) return { value: null, error: "invalid" };
      s = s.split(sep).join("");
    } else {
      s = s.replace(sep, ".");
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(s)) return { value: null, error: "invalid" };
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s)) {
    return { value: null, error: "tooManyDecimals" };
  }
  const value = Number(s);
  return Number.isFinite(value) ? { value: sign * value, error: null } : { value: null, error: "invalid" };
}

export function parseMoneyInput(raw: string, options: ParseMoneyInputOptions = {}): number | null {
  return parseMoneyInputDetailed(raw, options).value;
}

const INPUT_LOCALE_TAG: Record<string, string> = { en: "en-GB", fr: "fr-FR", vi: "vi-VN" };

/**
 * A stored number as the text of an input in `locale`: the locale's decimal
 * mark, no thousands separator, at most `maxDecimals` (float noise dropped), and
 * at least `minDecimals` once the value has a fraction: 12500.5 -> "12500,50"
 * (fr, minDecimals 2), 8.99 -> "8,99", 12500 -> "12500". `parseMoneyInput`
 * reads every result back. Empty for null.
 */
export function formatMoneyInput(
  value: number | null | undefined,
  locale: string,
  { minDecimals = 0, maxDecimals = 4 }: { minDecimals?: number; maxDecimals?: number } = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const rounded = Number(value.toPrecision(15));
  const scale = 10 ** maxDecimals;
  const hasFraction = Math.round(Math.abs(rounded) * scale) % scale !== 0;
  const text = new Intl.NumberFormat(INPUT_LOCALE_TAG[locale] ?? "fr-FR", {
    useGrouping: false,
    minimumFractionDigits: hasFraction ? Math.min(minDecimals, maxDecimals) : 0,
    maximumFractionDigits: maxDecimals,
  }).format(rounded);
  // 1.859 written "1,859" would read back as ambiguous; "1,8590" cannot.
  return maxDecimals > 3 && AMBIGUOUS_RE.test(text.replace(/^[-−]/, "")) ? `${text}0` : text;
}
