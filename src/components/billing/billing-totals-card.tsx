/**
 * BillingTotalsCard — live totals display (HT / TVA per rate / TTC).
 *
 * Rounding rule (the backend's): each line's HT is rounded half-up to the
 * cent, each line's TVA is its rounded HT × rate, rounded half-up to the cent,
 * and the document totals are the sums of those rounded line amounts, so the
 * lines always add up to the totals. The arithmetic is exact (BigInt on the
 * decimal strings), never float: 2.5 × 19.99 = 49.975 rounds to 49.98, where
 * float math gives 49.97. No new npm deps.
 */

import { useLocale, useTranslations } from "next-intl";
import type { BillingDocumentItem } from "@/types/billing";
import { formatBillingVatRate } from "@/lib/billing/vat-rate";

// ---------------------------------------------------------------------------
// Exact decimal helpers
// ---------------------------------------------------------------------------

// BigInt literals (0n) need an ES2020 target; this project targets ES2017.
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);

/** A decimal as an integer and a count of decimal places: 12.5 → { units: 125, scale: 1 }. */
interface ScaledDecimal {
  units: bigint;
  scale: number;
}

const DECIMAL = /^\s*(-?)(\d*)(?:\.(\d*))?\s*$/;

/** Parse a decimal string exactly; invalid or empty input reads as 0. */
function parseDecimal(value: string): ScaledDecimal {
  let text = value ?? "";
  if (!DECIMAL.test(text)) {
    // e.g. "1e3" from a number input — fall back to its plain notation.
    const n = Number(text);
    text = Number.isFinite(n) ? n.toFixed(10) : "0";
  }
  const [, sign, int, frac = ""] = DECIMAL.exec(text)!;
  const digits = `${int}${frac}` || "0";
  const units = BigInt(digits) * (sign ? -ONE : ONE);
  return { units, scale: frac.length };
}

/** numerator / denominator rounded half-up (away from zero on .5), denominator > 0. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < ZERO;
  const abs = negative ? -numerator : numerator;
  const rounded = (abs * TWO + denominator) / (denominator * TWO);
  return negative ? -rounded : rounded;
}

const pow10 = (n: number): bigint => TEN ** BigInt(n);

/** Line HT in cents: quantity × unit price, rounded half-up to the cent. */
function lineHtCents(item: BillingDocumentItem): bigint {
  const qty = parseDecimal(item.quantity);
  const price = parseDecimal(item.unit_price);
  // units × 10^-(scale) → cents = units × 100 / 10^scale
  return divRoundHalfUp(qty.units * price.units * HUNDRED, pow10(qty.scale + price.scale));
}

/** Line TVA in cents: rounded line HT × rate / 100, rounded half-up to the cent. */
function lineTvaCents(htCents: bigint, vatRate: string): bigint {
  const rate = parseDecimal(vatRate);
  return divRoundHalfUp(htCents * rate.units, HUNDRED * pow10(rate.scale));
}

/** "20.00" and "20" are the same rate: key and label it as "20". */
function normalizeRate(vatRate: string): string {
  const { units, scale } = parseDecimal(vatRate);
  const negative = units < ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

const toEuros = (cents: bigint): number => Number(cents) / 100;

/** Line total before VAT, rounded to the cent as the backend does. */
export function lineTotalHt(item: BillingDocumentItem): number {
  return toEuros(lineHtCents(item));
}

interface VatLine {
  rate: string; // e.g. "20"
  baseHt: number;
  tvaAmount: number;
}

export interface ComputedTotals {
  totalHt: number;
  vatLines: VatLine[];
  totalTva: number;
  totalTtc: number;
}

/**
 * Compute document totals from a list of items.
 * Export so BillingDocumentItemsEditor can call it for live updates.
 */
export function computeTotals(items: BillingDocumentItem[]): ComputedTotals {
  const vatMap = new Map<string, { baseHt: bigint; tvaAmount: bigint }>();
  let totalHt = ZERO;
  let totalTva = ZERO;

  for (const item of items) {
    const ht = lineHtCents(item);
    const tva = lineTvaCents(ht, item.vat_rate);
    totalHt += ht;
    totalTva += tva;
    const rateKey = normalizeRate(item.vat_rate);
    const existing = vatMap.get(rateKey) ?? { baseHt: ZERO, tvaAmount: ZERO };
    vatMap.set(rateKey, {
      baseHt: existing.baseHt + ht,
      tvaAmount: existing.tvaAmount + tva,
    });
  }

  // Sort VAT lines descending by rate
  const vatLines: VatLine[] = Array.from(vatMap.entries())
    .map(([rate, v]) => ({ rate, baseHt: toEuros(v.baseHt), tvaAmount: toEuros(v.tvaAmount) }))
    .sort((a, b) => Number(b.rate) - Number(a.rate));

  return {
    totalHt: toEuros(totalHt),
    vatLines,
    totalTva: toEuros(totalTva),
    totalTtc: toEuros(totalHt + totalTva),
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BillingTotalsCardProps {
  totals: ComputedTotals;
}

export function BillingTotalsCard({ totals }: BillingTotalsCardProps) {
  const t = useTranslations("billing.form.totals");
  const locale = useLocale();

  return (
    <div className="folio-card space-y-2 p-4">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: "var(--muted)" }}>{t("ht")}</span>
        <span className="num font-medium">{formatEUR(totals.totalHt)}</span>
      </div>

      {totals.vatLines.map((line) => (
        <div key={line.rate} className="flex items-center justify-between text-[13px]">
          <span style={{ color: "var(--muted)" }}>{t("tva", { rate: formatBillingVatRate(line.rate, locale) })}</span>
          <span className="num">{formatEUR(line.tvaAmount)}</span>
        </div>
      ))}

      <div
        className="flex items-center justify-between border-t pt-2 text-sm font-semibold"
        style={{ borderColor: "var(--border)" }}
      >
        <span>{t("ttc")}</span>
        <span className="num">{formatEUR(totals.totalTtc)}</span>
      </div>
    </div>
  );
}
