/**
 * HT / VAT split of an expense, computed exactly.
 *
 * The API returns each line's quantity, unit price and VAT rate plus the
 * invoice's TTC total: the sum of its line TTCs, each rounded half-up to the
 * cent. Computing `quantity * unit_price` in floats gives 50.294999… for
 * 50.295 and shows 50,29 € instead of 50,30 €, so each line's HT is done in
 * scaled integers and rounded half-up to the cent the same way before summing;
 * the VAT is then TTC − HT so the three rows add up (and 0 % lines carry none).
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
  const htCents = items.reduce(
    (sum, it) =>
      sum + toCents(scaled(it.quantity, QTY_SCALE) * scaled(it.unit_price, PRICE_SCALE), scale),
    BigInt(0)
  );
  const ttcCents = BigInt(Math.round(totalTtc * 100));
  return {
    totalHt: Number(htCents) / 100,
    totalVat: Number(ttcCents - htCents) / 100,
  };
}

export interface InvoiceVatLineLike extends InvoiceLineLike {
  /** VAT rate in percent; missing reads as 0 (legacy lines). */
  vat_rate?: number;
}

const TEN = BigInt(10);

/** A number as an exact decimal: 1.859 → { units: 1859n, scale: 3 }. */
function exactDecimal(value: number): { units: bigint; scale: number } {
  // String() gives the shortest digits that round-trip, i.e. the ones typed or
  // sent by the API (Python reads the same digits); exponent forms go through toFixed.
  const text = /e/i.test(String(value)) ? value.toFixed(20) : String(value);
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return { units: BigInt(0), scale: 0 };
  const [, sign, int, frac = ""] = m;
  return { units: BigInt(int + frac) * (sign ? -BigInt(1) : BigInt(1)), scale: frac.length };
}

/** A line's TTC in cents as an exact fraction num / 10^exp: qty × price × (100 + vat). */
function lineTtcCents(line: InvoiceVatLineLike): { num: bigint; exp: number } {
  const q = exactDecimal(line.quantity);
  const p = exactDecimal(line.unit_price);
  const v = exactDecimal(line.vat_rate ?? 0);
  return {
    num: q.units * p.units * (BigInt(100) * TEN ** BigInt(v.scale) + v.units),
    exp: q.scale + p.scale + v.scale,
  };
}

/** num / 10^exp rounded half away from zero, like the API's ROUND_HALF_UP. */
function roundHalfUp(num: bigint, exp: number): bigint {
  const den = TEN ** BigInt(exp);
  const negative = num < BigInt(0);
  const abs = negative ? -num : num;
  const rounded = (abs * BigInt(2) + den) / (BigInt(2) * den);
  return negative ? -rounded : rounded;
}

/**
 * A line's TTC as the API shows it: qty × price × (1 + vat/100) computed
 * exactly, rounded half-up to the cent. In floats 1 × 5 × 1.055 is
 * 5.2749999…, which displays as 5,27 € while the API stores 5,28 €.
 */
export function lineTotalTtc(line: InvoiceVatLineLike): number {
  const { num, exp } = lineTtcCents(line);
  return Number(roundHalfUp(num, exp)) / 100;
}

/**
 * An expense's TTC as the API stores it: each line's TTC rounded half-up to the
 * cent, then summed — so the total is exactly the sum of the lines shown.
 */
export function invoiceTotalTtc(lines: InvoiceVatLineLike[]): number {
  const cents = lines.reduce((acc, line) => {
    const { num, exp } = lineTtcCents(line);
    return acc + roundHalfUp(num, exp);
  }, BigInt(0));
  return Number(cents) / 100;
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
