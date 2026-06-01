/**
 * BillingTotalsCard — live totals display (HT / TVA per rate / TTC).
 *
 * Best-effort live preview only. Arithmetic uses Number() (float) internally,
 * which may differ from the server's Python Decimal result for edge cases like
 * 1.005. The server is authoritative for stored totals; this component is for
 * interactive feedback only. No new npm deps.
 */

import { useTranslations } from "next-intl";
import type { BillingDocumentItem } from "@/types/billing";

// ---------------------------------------------------------------------------
// Arithmetic helpers — float-based (best-effort preview; server is authoritative)
// ---------------------------------------------------------------------------

/** Parse a decimal string to number, returning 0 on invalid input. */
function parseDecimal(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimal places (half-up, float-based). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
  const vatMap = new Map<string, { baseHt: number; tvaAmount: number }>();
  let totalHt = 0;

  for (const item of items) {
    const qty = parseDecimal(item.quantity);
    const up = parseDecimal(item.unit_price);
    const rate = parseDecimal(item.vat_rate);
    const lineHt = round2(qty * up);
    const lineTva = round2(lineHt * (rate / 100));
    totalHt = round2(totalHt + lineHt);
    const rateKey = item.vat_rate;
    const existing = vatMap.get(rateKey) ?? { baseHt: 0, tvaAmount: 0 };
    vatMap.set(rateKey, {
      baseHt: round2(existing.baseHt + lineHt),
      tvaAmount: round2(existing.tvaAmount + lineTva),
    });
  }

  // Sort VAT lines descending by rate
  const vatLines: VatLine[] = Array.from(vatMap.entries())
    .map(([rate, v]) => ({ rate, baseHt: v.baseHt, tvaAmount: v.tvaAmount }))
    .sort((a, b) => parseDecimal(b.rate) - parseDecimal(a.rate));

  const totalTva = round2(vatLines.reduce((acc, l) => acc + l.tvaAmount, 0));
  const totalTtc = round2(totalHt + totalTva);

  return { totalHt, vatLines, totalTva, totalTtc };
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

  return (
    <div className="folio-card space-y-2 p-4">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: "var(--muted)" }}>{t("ht")}</span>
        <span className="num font-medium">{formatEUR(totals.totalHt)}</span>
      </div>

      {totals.vatLines.map((line) => (
        <div key={line.rate} className="flex items-center justify-between text-[13px]">
          <span style={{ color: "var(--muted)" }}>{t("tva", { rate: line.rate })}</span>
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
