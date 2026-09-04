/**
 * Money and price helpers for the chiffrage UI.
 *
 * Cents matter here (a 12-unit line at 10.75 is not the same budget as at
 * 11.00), so these deliberately do not reuse fmtEUR from budget-display, which
 * rounds to whole euros for the project funding envelope.
 */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a monetary amount with cents, e.g. "142,80 €". */
export function money(value: number): string {
  return EUR.format(value);
}

/** Format a quantity, trimming trailing zeros: 12, 3.5, 0.75. */
export function quantity(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
}

/**
 * Convert a TTC price to HT at the given VAT rate.
 *
 * The quote form lets the user type whichever figure the supplier published —
 * Leroy Merlin prints TTC on the shelf, Point P quotes HT — and stores the
 * canonical HT. Without this, comparing the two is a 20% error.
 */
export function ttcToHt(ttc: number, tvaRate: number): number {
  return ttc / (1 + tvaRate / 100);
}

/** Convert an HT price to TTC at the given VAT rate. */
export function htToTtc(ht: number, tvaRate: number): number {
  return ht * (1 + tvaRate / 100);
}

/**
 * Percentage a price sits above the cheapest one, e.g. 0.15 for "+15%".
 * Returns null when there is nothing to compare against.
 */
export function deltaVsCheapest(price: number, cheapest: number): number | null {
  if (cheapest <= 0 || price === cheapest) return null;
  return (price - cheapest) / cheapest;
}

/** Format a delta as a signed percentage, e.g. "+15 %". */
export function formatDelta(delta: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits,
    signDisplay: "always",
  }).format(delta);
}
