/**
 * HT / VAT split of an expense, computed exactly.
 *
 * The API returns each line's quantity, unit price and VAT rate plus the
 * invoice's TTC total (exact Decimal, rounded half-up to the cent). Summing
 * `quantity * unit_price` in floats gives 50.294999… for 50.295 and shows
 * 50,29 € instead of 50,30 €, so the HT sum is done in scaled integers and
 * rounded half-up once; the VAT is then TTC − HT so the three rows add up.
 */

const QTY_SCALE = BigInt(1_000); // quantities carry up to 3 decimals
const PRICE_SCALE = BigInt(10_000); // unit prices up to 4 decimals

function scaled(value: number, scale: bigint): bigint {
  return BigInt(Math.round(value * Number(scale)));
}

/** Round a non-negative or negative scaled amount half away from zero to cents. */
function toCents(amount: bigint, scale: bigint): bigint {
  const perCent = scale / BigInt(100);
  const sign = amount < BigInt(0) ? -BigInt(1) : BigInt(1);
  const abs = amount * sign;
  return sign * ((abs + perCent / BigInt(2)) / perCent);
}

export interface InvoiceLineLike {
  quantity: number;
  unit_price: number;
}

export function invoiceTotals(
  items: InvoiceLineLike[],
  totalTtc: number
): { totalHt: number; totalVat: number } {
  const scale = QTY_SCALE * PRICE_SCALE;
  const htScaled = items.reduce(
    (sum, it) => sum + scaled(it.quantity, QTY_SCALE) * scaled(it.unit_price, PRICE_SCALE),
    BigInt(0)
  );
  const htCents = toCents(htScaled, scale);
  const ttcCents = BigInt(Math.round(totalTtc * 100));
  return {
    totalHt: Number(htCents) / 100,
    totalVat: Number(ttcCents - htCents) / 100,
  };
}

/** A quantity in the app's language ("1,5" in French), up to 3 decimals. */
export function formatQuantity(quantity: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantity);
}

/** A VAT rate in the app's language ("5,5 %" in French). */
export function formatVatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate / 100);
}
