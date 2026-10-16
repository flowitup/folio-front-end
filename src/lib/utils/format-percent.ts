/**
 * Locale-aware whole percent from a 0–100 figure: "29%" in en and vi,
 * "29 %" in fr — the same spacing the Bank credit card's Intl output uses,
 * so one page never mixes both. `signed` adds "+" to a positive change.
 */
export function formatPercent(locale: string, value: number, signed = false): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value / 100);
}

/**
 * A share of a whole (0–100), like `formatPercent` but with one decimal below
 * 1 %, so a real 0,37 % reads "0,4 %" rather than a "0 %" that says nothing
 * was spent.
 */
export function formatShare(locale: string, value: number): string {
  const small = value !== 0 && Math.abs(value) < 1;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: small ? 1 : 0,
  }).format(value / 100);
}
