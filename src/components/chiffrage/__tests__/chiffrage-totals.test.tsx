/**
 * chiffrage-totals.test.tsx
 *
 * The dashboard at the top of the chiffrage: spend against the estimate, a bar
 * pair per section, and an attention list that surfaces unpriced items, items
 * over their estimate and sections with nothing bought.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ChiffrageTotals } from "../chiffrage-totals";
import type { ChiffrageArticle, ChiffragePoste, ChiffrageTree } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, v?: Record<string, unknown>) =>
    v ? `${key} ${Object.values(v).join("|")}` : key,
}));

const art = (id: string, poste: string, over: Partial<ChiffrageArticle> = {}): ChiffrageArticle => ({
  id, poste_id: poste, name: `Item ${id}`, quantity: 10, unit: "u", note: null, room_id: null,
  position: 1000, quotes: [], image_ref: null, effective_quote_id: "q", effective_source: "cheapest",
  total_ht: 100, total_ttc: 120, purchased: false, purchased_quantity: null, returned_quantity: null,
  actual_ttc: null, ...over,
});

const poste = (id: string, name: string, articles: ChiffrageArticle[], over: Partial<ChiffragePoste> = {}): ChiffragePoste => ({
  id, project_id: "p", name, note: null, position: 1000, articles, store_baskets: [], room_subtotals: [],
  subtotal_ht: 0, subtotal_ttc: articles.reduce((s, a) => s + a.total_ttc, 0),
  actual_ttc: articles.reduce((s, a) => s + (a.actual_ttc ?? 0), 0),
  purchased_count: articles.filter((a) => a.purchased).length, ...over,
});

const tree = (postes: ChiffragePoste[], over: Partial<ChiffrageTree> = {}): ChiffrageTree => ({
  project_id: "p", postes, rooms: [], stores: [], store_baskets: [], total_ht: 0,
  total_ttc: postes.reduce((s, p) => s + p.subtotal_ttc, 0), unpriced_article_count: 0,
  actual_ttc: postes.reduce((s, p) => s + p.actual_ttc, 0),
  purchased_count: postes.reduce((s, p) => s + p.purchased_count, 0),
  article_count: postes.reduce((s, p) => s + p.articles.length, 0), ...over,
});

describe("ChiffrageTotals dashboard", () => {
  it("lists over-budget, unpriced and untouched sections", () => {
    const t = tree([
      poste("a", "Doublage", [
        art("1", "a", { purchased: true, purchased_quantity: 10, actual_ttc: 130 }),
        art("2", "a", { effective_source: "none", effective_quote_id: null, total_ttc: 0 }),
      ]),
      poste("b", "Chauffage", [art("3", "b")]),
    ], { unpriced_article_count: 1 });
    render(<ChiffrageTotals tree={t} />);
    const list = screen.getByTestId("attention-list");
    expect(within(list).getByText(/dashUnpriced Item 2/)).toBeTruthy();
    expect(within(list).getByText(/dashOver Item 1/)).toBeTruthy();
    expect(within(list).getByText(/dashNoPurchase Chauffage/)).toBeTruthy();
    expect(screen.getByTestId("unpriced-warning")).toBeTruthy();
    expect(screen.getByTestId("section-bars").querySelectorAll("li")).toHaveLength(2);
  });

  it("shows the gap as a signed amount and says nothing needs attention when clean", () => {
    const t = tree([
      poste("a", "Doublage", [art("1", "a", { purchased: true, purchased_quantity: 10, actual_ttc: 100 })]),
    ]);
    render(<ChiffrageTotals tree={t} />);
    expect(screen.getByTestId("actual-summary").textContent).toMatch(/[-−]20,00/);
    expect(screen.getByText("dashNothing")).toBeTruthy();
  });

  it("hides the spend block before anything is bought", () => {
    render(<ChiffrageTotals tree={tree([poste("a", "Doublage", [art("1", "a")])])} />);
    expect(screen.queryByTestId("actual-summary")).toBeNull();
  });
});
