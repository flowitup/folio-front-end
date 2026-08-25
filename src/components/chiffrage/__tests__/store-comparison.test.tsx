/**
 * store-comparison.test.tsx
 *
 * The failure this component exists to prevent: a basket total that skips the
 * items a shop has no price for makes the *least* complete shop look cheapest.
 * Price three of twenty items at one shop and it "wins" at a fraction of the
 * real cost. These tests pin that a partial basket is never ranked first, never
 * badged cheapest, and never shown without its coverage.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { StoreComparison } from "../store-comparison";
import { shopNameFor } from "../shop-label";
import type { ChiffrageStore, ChiffrageStoreBasket } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, opts?: Record<string, unknown>) =>
      key === "coverageOf" ? `${opts?.priced} of ${opts?.total}` : key,
}));

const shop = (id: string, name: string): ChiffrageStore => ({
  id,
  project_id: "proj1",
  name,
  address: null,
  website_url: null,
  position: 1000,
});

const basket = (
  storeId: string,
  over: Partial<ChiffrageStoreBasket> = {},
): ChiffrageStoreBasket => ({
  store_id: storeId,
  basket_ht: 100,
  basket_ttc: 120,
  priced_article_count: 2,
  total_article_count: 2,
  missing_article_ids: [],
  covers_all: true,
  ...over,
});

const SHOPS = [shop("lm", "Leroy Merlin"), shop("pp", "Point P")];

function renderComparison(baskets: ChiffrageStoreBasket[]) {
  render(
    <StoreComparison
      baskets={baskets}
      stores={SHOPS}
      bestMixHt={90}
      title="Compare shops"
      subtitle="What it costs where"
    />,
  );
}

describe("StoreComparison", () => {
  it("marks the cheapest shop that actually covers everything", () => {
    renderComparison([
      basket("pp", { basket_ht: 80 }),
      basket("lm", { basket_ht: 100 }),
    ]);
    const badge = screen.getByTestId("cheapest-basket");
    expect(within(badge.closest("tr")!).getByText("Point P")).toBeInTheDocument();
  });

  it("never badges a cheaper but incomplete shop as cheapest", () => {
    renderComparison([
      basket("lm", {
        basket_ht: 5,
        priced_article_count: 1,
        missing_article_ids: ["a2"],
        covers_all: false,
      }),
      basket("pp", { basket_ht: 100 }),
    ]);
    const badge = screen.getByTestId("cheapest-basket");
    // Point P costs 20x more but is the only one that can supply the job.
    expect(within(badge.closest("tr")!).getByText("Point P")).toBeInTheDocument();
  });

  it("ranks the complete shops above the partial ones, however cheap", () => {
    renderComparison([
      basket("lm", {
        basket_ht: 5,
        priced_article_count: 1,
        missing_article_ids: ["a2"],
        covers_all: false,
      }),
      basket("pp", { basket_ht: 100 }),
    ]);
    const rows = screen.getAllByTestId("store-basket-row");
    expect(rows[0]).toHaveAttribute("data-covers-all", "true");
    expect(rows[1]).toHaveAttribute("data-covers-all", "false");
  });

  it("separates partial baskets under an explicit heading", () => {
    renderComparison([
      basket("pp"),
      basket("lm", { priced_article_count: 1, covers_all: false }),
    ]);
    expect(screen.getByTestId("partial-basket-heading")).toBeInTheDocument();
  });

  it("omits the heading when every shop covers the job", () => {
    renderComparison([basket("pp"), basket("lm")]);
    expect(screen.queryByTestId("partial-basket-heading")).not.toBeInTheDocument();
  });

  it("shows coverage on every row, so a total is never read alone", () => {
    renderComparison([
      basket("pp"),
      basket("lm", { priced_article_count: 1, covers_all: false }),
    ]);
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("refuses to compare a partial basket against the best mix", () => {
    renderComparison([
      basket("lm", { basket_ht: 5, priced_article_count: 1, covers_all: false }),
    ]);
    // A premium computed from an incomplete basket would be a fiction.
    expect(screen.getByText("notComparable")).toBeInTheDocument();
  });

  it("marks no shop cheapest when none covers the whole job", () => {
    renderComparison([
      basket("lm", { basket_ht: 5, priced_article_count: 1, covers_all: false }),
      basket("pp", { basket_ht: 9, priced_article_count: 1, covers_all: false }),
    ]);
    expect(screen.queryByTestId("cheapest-basket")).not.toBeInTheDocument();
  });

  it("leaves out shops with nothing priced in this scope", () => {
    renderComparison([
      basket("pp"),
      basket("lm", {
        basket_ht: 0,
        priced_article_count: 0,
        total_article_count: 2,
        covers_all: false,
      }),
    ]);
    expect(screen.getAllByTestId("store-basket-row")).toHaveLength(1);
    expect(screen.queryByText("Leroy Merlin")).not.toBeInTheDocument();
  });

  it("renders nothing at all when no shop has a price", () => {
    const { container } = render(
      <StoreComparison
        baskets={[basket("lm", { priced_article_count: 0, covers_all: false })]}
        stores={SHOPS}
        bestMixHt={0}
        title="Compare shops"
        subtitle="What it costs where"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("shopNameFor", () => {
  const shops = [shop("lm", "Leroy Merlin")];

  it("names the shop from the link, not the stored text", () => {
    // A price created with store_id alone carries no snapshot; reading the
    // snapshot would render a real shop as an unnamed supplier.
    expect(
      shopNameFor({ store_id: "lm", supplier_name: null }, shops),
    ).toBe("Leroy Merlin");
  });

  it("prefers the current shop name over a stale snapshot", () => {
    expect(
      shopNameFor({ store_id: "lm", supplier_name: "Old Name" }, shops),
    ).toBe("Leroy Merlin");
  });

  it("falls back to the snapshot when the shop was deleted", () => {
    expect(
      shopNameFor({ store_id: null, supplier_name: "Closed Shop" }, shops),
    ).toBe("Closed Shop");
  });

  it("returns null when there is nothing to show", () => {
    expect(shopNameFor({ store_id: null, supplier_name: null }, shops)).toBeNull();
    expect(shopNameFor(undefined, shops)).toBeNull();
  });
});
