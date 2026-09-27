/**
 * Day counts in the app's language: "5", "5.5" in English, "5,5" in French.
 * A whole number shows no decimals; a fraction up to two ("5,25").
 */
export function formatDays(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/** Bonus days: a whole number, or one decimal ("1,5"). */
export function formatBonusDays(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}
