import { describe, expect, it } from "vitest";

import { byPhase, isFiltering, matchesFilter, noteGroup, orderByGroup, phaseRanks, stageChoices } from "../list-filter";
import type { ChiffrageArticle, ChiffragePoste } from "@/lib/api/chiffrage";

const a = (id: string, over: Partial<ChiffrageArticle> = {}): ChiffrageArticle => ({
  id, poste_id: "p", name: `Item ${id}`, quantity: 1, unit: null, note: null, room_id: null, position: 0,
  quotes: [], image_ref: null, effective_quote_id: null, effective_source: "cheapest", total_ht: 1, total_ttc: 1.2,
  purchased: false, purchased_quantity: null, returned_quantity: null, actual_ttc: null, ...over,
});

describe("list-filter", () => {
  it("reads a leading [group] tag and leaves other notes alone", () => {
    expect(noteGroup("[Câbles & gaines] Réf. 1")).toEqual({ group: "Câbles & gaines", rest: "Réf. 1" });
    expect(noteGroup("Réf. [x] 1")).toEqual({ group: null, rest: "Réf. [x] 1" });
    expect(noteGroup(null)).toEqual({ group: null, rest: "" });
  });

  it("matches every word, accents and case ignored, and the status", () => {
    const x = a("1", { name: "Gaine préfilée Ø20 3G2,5", note: "[Cáp & ống] Réf. LM 63859474" });
    expect(matchesFilter(x, { query: "gaine 63859474", status: "all" })).toBe(true);
    expect(matchesFilter(x, { query: "PREFILEE", status: "all" })).toBe(true);
    expect(matchesFilter(x, { query: "cap ong", status: "all" })).toBe(true);
    expect(matchesFilter(x, { query: "gaine 99", status: "all" })).toBe(false);
    expect(matchesFilter(x, { query: "", status: "bought" })).toBe(false);
    expect(matchesFilter({ ...x, effective_source: "none" }, { query: "", status: "unpriced" })).toBe(true);
  });

  it("keeps each group together in the order it first appears", () => {
    const list = [a("1", { note: "[B] x" }), a("2"), a("3", { note: "[A] y" }), a("4", { note: "[B] z" })];
    expect(orderByGroup(list).map((i) => i.id)).toEqual(["2", "1", "4", "3"]);
    const plain = [a("1"), a("2")];
    expect(orderByGroup(plain)).toBe(plain);
  });

  const poste = (over: Partial<ChiffragePoste>): ChiffragePoste => ({
    id: "p", project_id: "proj", name: "Électricité", note: null, position: 0, articles: [], store_baskets: [],
    room_subtotals: [], subtotal_ht: 0, subtotal_ttc: 0, actual_ttc: 0, purchased_count: 0, ...over,
  });

  it("splits a poste by stage in its order, empty stages kept and unassigned lines last", () => {
    const p = poste({
      phases: [{ id: "g1", name: "Gaines", position: 1 }, { id: "g2", name: "Appareillage", position: 2 }, { id: "g3", name: "Vide", position: 3 }],
      articles: [a("1", { phase_id: "g2" }), a("2", { phase_id: "g1" }), a("3"), a("4", { phase_id: "gone" })],
    });
    const buckets = byPhase(p);
    expect(buckets.map((b) => [b.phase?.id ?? null, b.rank, b.articles.map((x) => x.id)])).toEqual([
      ["g1", 0, ["2"]],
      ["g2", 1, ["1"]],
      ["g3", 2, []],
      [null, null, ["3", "4"]],
    ]);
    // No stages: one bucket with everything; no unassigned bucket when all lines have a stage.
    expect(byPhase(poste({ articles: [a("1")] })).map((b) => b.articles.length)).toEqual([1]);
    expect(byPhase(poste({ phases: [{ id: "g1", name: "x", position: 1 }], articles: [a("1", { phase_id: "g1" })] }))).toHaveLength(1);
  });

  it("filters on the n-th stage of every poste", () => {
    const postes = [
      poste({ id: "elec", phases: [{ id: "e1", name: "Gaines", position: 1 }, { id: "e2", name: "Appareillage", position: 2 }] }),
      poste({ id: "plomb", phases: [{ id: "p1", name: "Réseau", position: 1 }] }),
    ];
    const ranks = phaseRanks(postes);
    const second = { query: "", status: "all" as const, stage: 1 };
    expect(isFiltering(second)).toBe(true);
    expect(matchesFilter(a("1", { phase_id: "e2" }), second, ranks)).toBe(true);
    expect(matchesFilter(a("2", { phase_id: "e1" }), second, ranks)).toBe(false);
    expect(matchesFilter(a("3"), second, ranks)).toBe(false);
    expect(matchesFilter(a("4", { phase_id: "p1" }), { ...second, stage: 0 }, ranks)).toBe(true);
    expect(stageChoices(postes)).toEqual([["Gaines", "Réseau"], ["Appareillage"]]);
  });
});
