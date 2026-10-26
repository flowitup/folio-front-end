/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ShoppingList } from "../shopping-list";
import type { ChiffrageArticle, ChiffrageTree } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const article = (id: string, over: Partial<ChiffrageArticle> = {}): ChiffrageArticle => ({
  id,
  poste_id: "p1",
  name: `Article ${id}`,
  quantity: 2,
  unit: null,
  note: null,
  room_id: null,
  position: 1000,
  quotes: [],
  image_ref: null,
  effective_quote_id: null,
  effective_source: "cheapest",
  total_ht: 10,
  total_ttc: 12,
  purchased: false,
  actual_ttc: null,
  ...over,
});

const tree = (): ChiffrageTree => ({
  project_id: "proj",
  postes: [
    {
      id: "p1",
      project_id: "proj",
      name: "Doublage",
      note: null,
      position: 1000,
      articles: [article("a1"), article("a2", { purchased: true, actual_ttc: 11 })],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 20,
      subtotal_ttc: 24,
      actual_ttc: 11,
      purchased_count: 1,
    },
  ],
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 20,
  total_ttc: 24,
  unpriced_article_count: 0,
  actual_ttc: 11,
  purchased_count: 1,
  article_count: 2,
});

describe("ShoppingList", () => {
  it("shows the real spend and ticks an article as bought", () => {
    const onToggle = vi.fn();
    render(
      <ShoppingList tree={tree()} canManage busyIds={new Set()} onTogglePurchased={onToggle} onSetActual={vi.fn()} />,
    );
    expect(screen.getByTestId("actual-total").textContent).toMatch(/11,00/);
    fireEvent.click(screen.getAllByLabelText("markBought")[0]);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), true);
  });

  it("hides bought rows when only the remaining ones are wanted", () => {
    render(
      <ShoppingList tree={tree()} canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetActual={vi.fn()} />,
    );
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("onlyToBuy"));
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(1);
  });

  it("does not let a read-only viewer tick", () => {
    render(
      <ShoppingList tree={tree()} canManage={false} busyIds={new Set()} onTogglePurchased={vi.fn()} onSetActual={vi.fn()} />,
    );
    screen.getAllByRole("checkbox").slice(1).forEach((c) => expect((c as HTMLInputElement).disabled).toBe(true));
  });
});
