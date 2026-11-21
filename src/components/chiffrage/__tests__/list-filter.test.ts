import { describe, expect, it } from "vitest";

import { matchesFilter, noteGroup, orderByGroup } from "../list-filter";
import type { ChiffrageArticle } from "@/lib/api/chiffrage";

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
});
