/**
 * compare-lines.test.ts
 *
 * The ledger arithmetic: gap is B − A per unit, the percentage is relative to
 * the cheaper price, a missing side is "unpriced" (never a gap against zero),
 * and the summary counts each line exactly once.
 */

import { describe, expect, it } from "vitest";

import {
  bestMixHt,
  buildCompareLines,
  formatGapPercent,
  lineVerdict,
  summarizeLines,
} from "../compare-lines";
import type { ChiffrageArticle, ChiffrageQuote } from "@/lib/api/chiffrage";

const quote = (
  id: string,
  storeId: string,
  ht: number,
  note: string | null = null,
): ChiffrageQuote => ({
  id,
  article_id: "a",
  store_id: storeId,
  supplier_id: null,
  supplier_name: null,
  library_product_id: null,
  unit_price_ht: ht,
  tva_rate: 20,
  unit_price_ttc: ht * 1.2,
  product_url: null,
  note,
  is_selected: false,
});

const article = (
  id: string,
  position: number,
  quotes: ChiffrageQuote[],
  quantity = 1,
): ChiffrageArticle => ({
  id,
  poste_id: "po",
  name: id,
  quantity,
  unit: null,
  note: null,
  room_id: null,
  position,
  quotes,
  image_ref: null,
  effective_quote_id: quotes[0]?.id ?? null,
  effective_source: quotes.length > 0 ? "cheapest" : "none",
  total_ht: 0,
  total_ttc: 0,
});

describe("lineVerdict", () => {
  it("reports the gap as B minus A, relative to the cheaper price", () => {
    const v = lineVerdict(quote("qa", "A", 1240), quote("qb", "B", 1385));
    expect(v).toEqual({ kind: "gap", gap: 145, pct: 145 / 1240, cheaper: "a" });
  });

  it("flips sign and winner when B is cheaper", () => {
    const v = lineVerdict(quote("qa", "A", 312.5), quote("qb", "B", 298));
    expect(v.kind).toBe("gap");
    if (v.kind !== "gap") return;
    expect(v.gap).toBeCloseTo(-14.5);
    expect(v.pct).toBeCloseTo(-14.5 / 298);
    expect(v.cheaper).toBe("b");
  });

  it("drops the percentage when the cheaper price is zero", () => {
    expect(lineVerdict(quote("qa", "A", 0), quote("qb", "B", 12))).toEqual({
      kind: "gap",
      gap: 12,
      pct: null,
      cheaper: "a",
    });
  });

  it("calls equal prices a tie and a missing side unpriced", () => {
    expect(lineVerdict(quote("qa", "A", 289), quote("qb", "B", 289))).toEqual({ kind: "tie" });
    expect(lineVerdict(quote("qa", "A", 289), null)).toEqual({ kind: "unpriced" });
    expect(lineVerdict(null, null)).toEqual({ kind: "unpriced" });
  });
});

describe("buildCompareLines / summarizeLines", () => {
  it("counts every line once and counts the differing runs across both notes", () => {
    const articles = [
      article("win-a", 1, [
        quote("q1", "A", 10, "VR Somfy radio, remise 42 %"),
        quote("q2", "B", 12, "VR Somfy filaire, remise 35 %"),
      ]),
      article("win-b", 2, [quote("q3", "A", 12), quote("q4", "B", 10)]),
      article("tie", 3, [quote("q5", "A", 5), quote("q6", "B", 5)]),
      article("unpriced", 4, [quote("q7", "A", 5)]),
      article("nothing", 5, []),
    ];
    const lines = buildCompareLines(articles, "A", "B");
    expect(lines.map((l) => l.article.id)).toEqual([
      "win-a",
      "win-b",
      "tie",
      "unpriced",
      "nothing",
    ]);
    // "radio" + "42" on A, "filaire" + "35" on B.
    expect(lines[0].differenceCount).toBe(4);
    expect(lines[1].differenceCount).toBe(0);
    expect(lines[3].expandable).toBe(true);
    expect(lines[4].expandable).toBe(false);
    expect(summarizeLines(lines)).toEqual({
      aWins: 1,
      bWins: 1,
      ties: 1,
      unpriced: 2,
      withNoteDifferences: 1,
    });
  });

  it("orders lines by article position, not array order", () => {
    const lines = buildCompareLines(
      [article("second", 20, []), article("first", 10, [])],
      "A",
      "B",
    );
    expect(lines.map((l) => l.article.id)).toEqual(["first", "second"]);
  });
});

describe("bestMixHt", () => {
  it("sums the cheapest quote per item times quantity, skipping unquoted items", () => {
    const articles = [
      article("a", 1, [quote("q1", "A", 10), quote("q2", "B", 8)], 2),
      article("b", 2, [quote("q3", "A", 5)], 3),
      article("c", 3, []),
    ];
    expect(bestMixHt(articles)).toBe(8 * 2 + 5 * 3);
  });
});

describe("formatGapPercent", () => {
  it("always carries a sign and one decimal in French style", () => {
    const plain = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");
    expect(plain(formatGapPercent(145 / 1240))).toBe("+11,7 %");
    expect(plain(formatGapPercent(-14.5 / 298))).toBe("-4,9 %");
  });
});
