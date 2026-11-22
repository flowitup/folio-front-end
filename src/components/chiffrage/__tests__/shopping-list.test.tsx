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
  purchased_quantity: null,
  returned_quantity: null,
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
      articles: [article("a1"), article("a2", { purchased: true, purchased_quantity: 3, returned_quantity: 0, actual_ttc: 18 })],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 20,
      subtotal_ttc: 24,
      actual_ttc: 18,
      purchased_count: 1,
    },
  ],
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 20,
  total_ttc: 24,
  unpriced_article_count: 0,
  actual_ttc: 18,
  purchased_count: 1,
  article_count: 2,
});

describe("ShoppingList", () => {
  it("shows the real spend and ticks an article as bought", () => {
    const onToggle = vi.fn();
    render(
      <ShoppingList tree={tree()} projectId="proj" canManage busyIds={new Set()} onTogglePurchased={onToggle} onSetQuantities={vi.fn()} />,
    );
    expect(screen.getByTestId("actual-total").textContent).toMatch(/18,00/);
    fireEvent.click(screen.getAllByLabelText("markBought")[0]);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), true);
  });

  it("hides bought rows when only the remaining ones are wanted", () => {
    const { rerender } = render(
      <ShoppingList tree={tree()} projectId="proj" canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(2);
    rerender(
      <ShoppingList
        tree={tree()}
        projectId="proj"
        filter={{ query: "", status: "toBuy" }}
        canManage
        busyIds={new Set()}
        onTogglePurchased={vi.fn()}
        onSetQuantities={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(1);
  });

  it("finds lines by words of the name or note, accents ignored", () => {
    const tr = tree();
    tr.postes[0].articles[0] = article("a1", { name: "Câble R2V 3G6", note: "[Câbles] Réf. LM 70808794" });
    render(
      <ShoppingList
        tree={tr}
        projectId="proj"
        filter={{ query: "cable 70808794", status: "all" }}
        canManage
        busyIds={new Set()}
        onTogglePurchased={vi.fn()}
        onSetQuantities={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(1);
    expect(screen.getByText("Câble R2V 3G6")).toBeDefined();
  });

  it("gathers lines under their [group] note tag, folds a group, and shows the note without the tag", () => {
    const tr = tree();
    tr.postes[0].articles = [
      article("a1", { note: "[Câbles] réf. 1", position: 1 }),
      article("a2", { note: "[Boîtes] réf. 2", position: 2 }),
      article("a3", { note: "[Câbles] réf. 3", position: 3 }),
    ];
    const onToggleGroup = vi.fn();
    const { rerender } = render(
      <ShoppingList tree={tr} projectId="proj" onToggleGroup={onToggleGroup} canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    const headings = screen.getAllByTestId("group-heading");
    expect(headings.map((h) => h.textContent)).toEqual([expect.stringContaining("Câbles"), expect.stringContaining("Boîtes")]);
    // a3 follows a1 under "Câbles", ahead of a2.
    expect(screen.getAllByTestId("shopping-row").map((r) => r.textContent)).toEqual([
      expect.stringContaining("Article a1"),
      expect.stringContaining("Article a3"),
      expect.stringContaining("Article a2"),
    ]);
    expect(screen.getByText("réf. 1")).toBeDefined();
    fireEvent.click(headings[0]);
    expect(onToggleGroup).toHaveBeenCalledWith("p1|shop|Câbles");
    rerender(
      <ShoppingList
        tree={tr}
        projectId="proj"
        collapsedGroups={new Set(["p1|shop|Câbles"])}
        canManage
        busyIds={new Set()}
        onTogglePurchased={vi.fn()}
        onSetQuantities={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(1);
  });

  it("shows a thumbnail slot on every line", () => {
    render(
      <ShoppingList tree={tree()} projectId="proj" canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    expect(screen.getAllByTestId("article-image-placeholder")).toHaveLength(2);
  });

  it("does not let a read-only viewer tick", () => {
    render(
      <ShoppingList tree={tree()} projectId="proj" canManage={false} busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    screen.getAllByRole("checkbox").forEach((c) => expect((c as HTMLInputElement).disabled).toBe(true));
  });

  it("shows how far a bought line and its section went over the estimate when more was bought", () => {
    render(
      <ShoppingList tree={tree()} projectId="proj" canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    // a2: estimate 12 for 2 planned, 3 bought: 18 spent, 6 over
    expect(screen.getByTestId("line-gap").textContent).toMatch(/\+6,00/);
    expect(screen.getByTestId("poste-gap").textContent).toMatch(/\+6,00/);
  });

  it("saves the quantity bought and the quantity returned", () => {
    const onQty = vi.fn();
    render(
      <ShoppingList tree={tree()} projectId="proj" canManage busyIds={new Set()} onTogglePurchased={vi.fn()} onSetQuantities={onQty} />,
    );
    const bought = screen.getByLabelText("boughtQuantity");
    fireEvent.change(bought, { target: { value: "4" } });
    fireEvent.blur(bought);
    expect(onQty).toHaveBeenCalledWith(expect.objectContaining({ id: "a2" }), { purchased_quantity: 4 });
    const returned = screen.getByLabelText("returnedQuantity");
    fireEvent.change(returned, { target: { value: "1" } });
    fireEvent.blur(returned);
    expect(onQty).toHaveBeenCalledWith(expect.objectContaining({ id: "a2" }), { returned_quantity: 1 });
  });

  it("splits a section by stage, with each stage's figures, and filters on one stage", () => {
    const tr = tree();
    tr.postes[0].phases = [
      { id: "g1", name: "Gaines", position: 1 },
      { id: "g2", name: "Appareillage", position: 2 },
    ];
    tr.postes[0].articles = [
      article("a1", { phase_id: "g2", position: 1 }),
      article("a2", { phase_id: "g1", position: 2, purchased: true, actual_ttc: 15 }),
      article("a3", { position: 3 }),
    ];
    tr.postes[0].phase_subtotals = [
      { phase_id: "g1", subtotal_ht: 10, subtotal_ttc: 12, actual_ttc: 15, article_count: 1, purchased_count: 1 },
      { phase_id: "g2", subtotal_ht: 10, subtotal_ttc: 12, actual_ttc: 0, article_count: 1, purchased_count: 0 },
      { phase_id: null, subtotal_ht: 10, subtotal_ttc: 12, actual_ttc: 0, article_count: 1, purchased_count: 0 },
    ];
    const onToggleGroup = vi.fn();
    const { rerender } = render(
      <ShoppingList tree={tr} projectId="proj" canManage busyIds={new Set()} onToggleGroup={onToggleGroup} onTogglePurchased={vi.fn()} onSetQuantities={vi.fn()} />,
    );
    const headings = screen.getAllByTestId("phase-heading");
    expect(headings.map((h) => h.textContent)).toEqual([
      expect.stringContaining("Gaines"),
      expect.stringContaining("Appareillage"),
      expect.stringContaining("noPhase"),
    ]);
    expect(screen.getAllByTestId("phase-actual")).toHaveLength(1);
    const rows = screen.getAllByTestId("shopping-row").map((r) => r.textContent);
    expect(rows[0]).toContain("Article a2");
    expect(rows[1]).toContain("Article a1");
    fireEvent.click(headings[0]);
    expect(onToggleGroup).toHaveBeenCalledWith("p1|phase|g1");

    rerender(
      <ShoppingList
        tree={tr}
        projectId="proj"
        filter={{ query: "", status: "all", stage: 1 }}
        canManage
        busyIds={new Set()}
        onTogglePurchased={vi.fn()}
        onSetQuantities={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("phase-heading")).toHaveLength(1);
    expect(screen.getAllByTestId("shopping-row")).toHaveLength(1);
    expect(screen.getByText("Article a1")).toBeDefined();
  });
});
