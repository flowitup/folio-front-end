/**
 * section-compare-dialog.test.tsx
 *
 * The modal defaults to the two best-covering shops and lays every item in the
 * section out side by side. These pin that behaviour, that a shop with no quote
 * for an item shows a dash (never a zero, which would read as free), and that
 * the cheaper shop per line is highlighted.
 */

import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  SHOW_DIFFERENCES_STORAGE_KEY,
  SectionCompareDialog,
} from "../section-compare-dialog";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageQuote,
  ChiffrageStore,
} from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const store = (id: string, name: string): ChiffrageStore => ({
  id,
  project_id: "proj",
  name,
  address: null,
  website_url: null,
  position: 0,
});

const quote = (
  id: string,
  articleId: string,
  storeId: string,
  ht: number,
  ttc: number,
  note: string | null = null,
): ChiffrageQuote => ({
  id,
  article_id: articleId,
  store_id: storeId,
  supplier_id: null,
  supplier_name: null,
  library_product_id: null,
  unit_price_ht: ht,
  tva_rate: 20,
  unit_price_ttc: ttc,
  product_url: null,
  note,
  is_selected: false,
});

const article = (
  id: string,
  name: string,
  position: number,
  quotes: ChiffrageQuote[],
): ChiffrageArticle => ({
  id,
  poste_id: "po",
  name,
  quantity: 1,
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

const ALPHA = store("A", "Alpha");
const BRAVO = store("B", "Bravo");

const poste = (): ChiffragePoste => ({
  id: "po",
  project_id: "proj",
  name: "Windows",
  note: null,
  position: 0,
  articles: [
    article("a1", "Item one", 1000, [
      quote("q1", "a1", "A", 10, 12, "Coulissant 1800×2200 VR Somfy radio, remise 42 %"),
      quote("q2", "a1", "B", 12, 14, "Coulissant 1800×2200 VR Somfy filaire, remise 35 %"),
    ]),
    article("a2", "Item two", 2000, [quote("q3", "a2", "A", 5, 6)]),
  ],
  // Alpha covers both items; Bravo only one — Alpha ranks first.
  store_baskets: [
    {
      store_id: "A",
      basket_ht: 15,
      basket_ttc: 18,
      priced_article_count: 2,
      total_article_count: 2,
      missing_article_ids: [],
      covers_all: true,
    },
    {
      store_id: "B",
      basket_ht: 12,
      basket_ttc: 14,
      priced_article_count: 1,
      total_article_count: 2,
      missing_article_ids: ["a2"],
      covers_all: false,
    },
  ],
  room_subtotals: [],
  subtotal_ht: 15,
  subtotal_ttc: 18,
});

const renderDialog = () =>
  render(
    <SectionCompareDialog
      open
      poste={poste()}
      stores={[ALPHA, BRAVO]}
      onOpenChange={() => {}}
    />,
  );

describe("SectionCompareDialog", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the two best-covering shops, one row per item", () => {
    renderDialog();
    const table = screen.getByTestId("section-compare-table");
    const heads = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(heads).toContain("Alpha");
    expect(heads).toContain("Bravo");
    expect(within(table).getAllByTestId("section-compare-row")).toHaveLength(2);
  });

  it("shows a dash where a shop has no price, never a zero", () => {
    renderDialog();
    const rows = screen.getAllByTestId("section-compare-row");
    // Item two, Bravo column (4th cell): no quote → dash.
    const bravoCell = rows[1].querySelectorAll("td")[3];
    expect(bravoCell.textContent).toBe("—");
  });

  it("highlights the cheaper shop on a contested line", () => {
    renderDialog();
    const rows = screen.getAllByTestId("section-compare-row");
    // Item one: Alpha 10 HT < Bravo 12 HT → Alpha highlighted, Bravo not.
    const alphaCell = rows[0].querySelectorAll("td")[2];
    const bravoCell = rows[0].querySelectorAll("td")[3];
    expect(alphaCell.querySelector(".text-primary")).not.toBeNull();
    expect(bravoCell.querySelector(".text-primary")).toBeNull();
  });

  it("renders a basket dash, not 0,00 €, for a column that prices nothing", () => {
    // Only Alpha prices anything, so the default pair is [Alpha, null] and the
    // second column has no shop. Its basket total must read as a dash, never a
    // zero that looks like a free basket.
    const singleShop: ChiffragePoste = {
      ...poste(),
      articles: [article("a1", "Only item", 1000, [quote("q1", "a1", "A", 10, 12)])],
      store_baskets: [
        {
          store_id: "A",
          basket_ht: 10,
          basket_ttc: 12,
          priced_article_count: 1,
          total_article_count: 1,
          missing_article_ids: [],
          covers_all: true,
        },
        {
          store_id: "B",
          basket_ht: 0,
          basket_ttc: 0,
          priced_article_count: 0,
          total_article_count: 1,
          missing_article_ids: ["a1"],
          covers_all: false,
        },
      ],
      subtotal_ht: 10,
      subtotal_ttc: 12,
    };
    render(
      <SectionCompareDialog
        open
        poste={singleShop}
        stores={[ALPHA, BRAVO]}
        onOpenChange={() => {}}
      />,
    );
    const footRow = screen
      .getByTestId("section-compare-table")
      .querySelector("tfoot tr")!;
    const cells = footRow.querySelectorAll("td");
    // cells: [label (colspan 2), Alpha basket, empty column].
    expect(cells[cells.length - 1].textContent).toBe("—");
    expect(cells[cells.length - 2].textContent).toContain("€");
  });

  it("keeps the note differences collapsed until asked, then remembers it", () => {
    renderDialog();
    expect(screen.queryByTestId("section-compare-note-row")).toBeNull();
    expect(screen.queryByTestId("compare-diff-legend")).toBeNull();

    fireEvent.click(screen.getByTestId("compare-diff-toggle"));

    expect(screen.getByTestId("compare-diff-legend")).toBeInTheDocument();
    expect(screen.getByTestId("compare-diff-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem(SHOW_DIFFERENCES_STORAGE_KEY)).toBe("1");
  });

  it("shows both notes under an item with only the differing words marked", () => {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, "1");
    renderDialog();
    const noteRows = screen.getAllByTestId("section-compare-note-row");
    // Item one has quotes on both sides; item two only on Alpha.
    expect(noteRows).toHaveLength(2);
    const cells = noteRows[0].querySelectorAll("td");
    const alphaMarks = [...cells[1].querySelectorAll("mark")].map((m) => m.textContent);
    const bravoMarks = [...cells[2].querySelectorAll("mark")].map((m) => m.textContent);
    expect(alphaMarks).toEqual(["radio", "42"]);
    expect(bravoMarks).toEqual(["filaire", "35"]);
    expect(cells[1].textContent).toBe("Coulissant 1800×2200 VR Somfy radio, remise 42 %");
  });

  it("says 'no note' for a quote without one and stays blank where there is no quote", () => {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, "1");
    renderDialog();
    const noteRows = screen.getAllByTestId("section-compare-note-row");
    const cells = noteRows[1].querySelectorAll("td");
    // Item two: Alpha priced it with no note; Bravo has no quote at all.
    expect(cells[1].textContent).toBe("compareNoNote");
    expect(cells[2].textContent).toBe("");
    expect(within(noteRows[1]).queryByTestId("note-diff")).toBeNull();
  });
});
