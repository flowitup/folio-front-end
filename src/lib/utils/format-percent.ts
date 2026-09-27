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
