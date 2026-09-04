/**
 * The arithmetic behind the head-to-head compare ledger, kept apart from the
 * dialog so it can be pinned by tests without rendering anything.
 *
 * Every line compares one article at shop A and shop B. The gap is always
 * `B − A` per unit, so a positive gap means B is dearer; the percentage is
 * relative to the cheaper price, which is the figure a buyer reasons with
 * ("Point P is 11,7 % more"). Notes are diffed here too so the row can say how
 * many things differ before anyone expands it.
 */

import {
  diffQuoteNotes,
  type NoteSegment,
} from "@/components/chiffrage/quote-note-diff";
import type { ChiffrageArticle, ChiffrageQuote } from "@/lib/api/chiffrage";

export type LineVerdict =
  /** Both shops priced it and the prices differ. `gap` is B − A per unit. */
  | { kind: "gap"; gap: number; pct: number; cheaper: "a" | "b" }
  /** Both shops priced it at the same unit price. */
  | { kind: "tie" }
  /** At least one side has no quote — nothing to compare on price. */
  | { kind: "unpriced" };

export interface CompareLine {
  article: ChiffrageArticle;
  quoteA: ChiffrageQuote | null;
  quoteB: ChiffrageQuote | null;
  verdict: LineVerdict;
  notesA: NoteSegment[];
  notesB: NoteSegment[];
  /** Runs of text present in one note only, counted across both sides. */
  differenceCount: number;
  /** Whether there is anything to show when the row is expanded. */
  expandable: boolean;
}

export interface CompareSummary {
  aWins: number;
  bWins: number;
  ties: number;
  unpriced: number;
  withNoteDifferences: number;
}

/** Cheapest recorded quote for an article at a shop, or null if none. */
export function quoteAt(
  article: ChiffrageArticle,
  storeId: string | null,
): ChiffrageQuote | null {
  if (!storeId) return null;
  const quotes = article.quotes.filter((q) => q.store_id === storeId);
  if (quotes.length === 0) return null;
  return quotes.reduce((a, b) => (b.unit_price_ht < a.unit_price_ht ? b : a));
}

export function lineVerdict(
  qa: ChiffrageQuote | null,
  qb: ChiffrageQuote | null,
): LineVerdict {
  if (!qa || !qb) return { kind: "unpriced" };
  const gap = qb.unit_price_ht - qa.unit_price_ht;
  if (gap === 0) return { kind: "tie" };
  const cheapest = Math.min(qa.unit_price_ht, qb.unit_price_ht);
  return {
    kind: "gap",
    gap,
    pct: cheapest > 0 ? gap / cheapest : 0,
    cheaper: gap > 0 ? "a" : "b",
  };
}

function countDifferences(segments: NoteSegment[]): number {
  return segments.filter((s) => s.differs).length;
}

export function buildCompareLines(
  articles: ChiffrageArticle[],
  shopA: string | null,
  shopB: string | null,
): CompareLine[] {
  return [...articles]
    .sort((a, b) => a.position - b.position)
    .map((article) => {
      const quoteA = quoteAt(article, shopA);
      const quoteB = quoteAt(article, shopB);
      const [notesA, notesB] = diffQuoteNotes([quoteA?.note, quoteB?.note]);
      return {
        article,
        quoteA,
        quoteB,
        verdict: lineVerdict(quoteA, quoteB),
        notesA,
        notesB,
        differenceCount: countDifferences(notesA) + countDifferences(notesB),
        // Only worth opening when at least one side has a quote to explain.
        expandable: quoteA != null || quoteB != null,
      };
    });
}

export function summarizeLines(lines: CompareLine[]): CompareSummary {
  const summary: CompareSummary = {
    aWins: 0,
    bWins: 0,
    ties: 0,
    unpriced: 0,
    withNoteDifferences: 0,
  };
  for (const line of lines) {
    const v = line.verdict;
    if (v.kind === "tie") summary.ties += 1;
    else if (v.kind === "unpriced") summary.unpriced += 1;
    else if (v.cheaper === "a") summary.aWins += 1;
    else summary.bWins += 1;
    if (line.differenceCount > 0) summary.withNoteDifferences += 1;
  }
  return summary;
}

const SIGNED_PERCENT = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "always",
});

/** "+11,7 %" — one decimal, always signed, so the direction is never implied. */
export function formatGapPercent(pct: number): string {
  return SIGNED_PERCENT.format(pct);
}
