/**
 * section-compare-dialog.test.tsx
 *
 * The ledger defaults to the two best-covering shops and lays every item in
 * the section out as a row. These pin that behaviour, that a shop with no
 * quote for an item says so (never a zero, which would read as free), that
 * the cheaper shop per line gets the dot and the gap column explains it, and
 * that expanding — one row or all — shows both notes with only the differing
 * words marked and remembers the all-open choice.
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

/** Intl pads French money and percent with narrow no-break spaces; tests read them as plain spaces. */
const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/[\u202f\u00a0]/g, " ");

vi.mock("next-intl", () => ({
  // Keys come back verbatim; interpolations are appended so a test can see
  // which values were handed to a message.
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join("|")})` : key,
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

const renderDialog = (showDifferencesDefault?: boolean) =>
  render(
    <SectionCompareDialog
      open
      poste={poste()}
      stores={[ALPHA, BRAVO]}
      onOpenChange={() => {}}
      showDifferencesDefault={showDifferencesDefault}
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

  it("ranks the full basket first in the strip and flags the partial one", () => {
    renderDialog();
    const cards = screen.getAllByTestId("compare-basket-card");
    expect(cards.map((c) => c.getAttribute("data-covers-all"))).toEqual(["true", "false"]);
    expect(within(cards[0]).getByTestId("cheapest-basket")).toBeInTheDocument();
    expect(cards[1].textContent).toContain("comparePricedOf(1|2)");
    expect(cards[1].textContent).toContain("compareMissingItems(1)");
  });

  it("says 'no quote' where a shop has no price, never a zero", () => {
    renderDialog();
    const rows = screen.getAllByTestId("section-compare-row");
    // Item two, Bravo column (4th cell): no quote → says so, gap is n/a.
    const cells = rows[1].querySelectorAll("td");
    expect(cells[3].textContent).toBe("compareNoQuote");
    expect(cells[4].textContent).toContain("compareNa");
    expect(cells[4].textContent).toContain("compareNotComparable");
  });

  it("dots the cheaper shop on a contested line and explains the gap", () => {
    renderDialog();
    const rows = screen.getAllByTestId("section-compare-row");
    // Item one: Alpha 10 HT < Bravo 12 HT → Alpha dotted, Bravo not.
    const cells = rows[0].querySelectorAll("td");
    expect(within(cells[2]).getByTestId("cheaper-dot")).toBeInTheDocument();
    expect(within(cells[3]).queryByTestId("cheaper-dot")).toBeNull();
    // Gap is B − A = +2,00 € per unit, +20 % at the dearer shop (Bravo).
    expect(plain(within(cells[4]).getByTestId("compare-gap").textContent)).toBe("+2,00 €");
    expect(plain(cells[4].textContent)).toContain("compareGapAt(+20 %|Bravo)");
  });

  it("summarises who wins where and how many items have note differences", () => {
    renderDialog();
    expect(screen.getByTestId("compare-summary").textContent).toBe(
      "compareSummary(Alpha|Bravo|1|0|0|1) · compareSummaryNotes(1)",
    );
    // Item one carries four differing runs across its two notes.
    const rows = screen.getAllByTestId("section-compare-row");
    expect(within(rows[0]).getByTestId("compare-difference-count").textContent).toBe(
      "compareDifferenceCount(4)",
    );
    expect(within(rows[1]).queryByTestId("compare-difference-count")).toBeNull();
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
    // cells: [label (colspan 2), Alpha basket, empty column, coverage].
    expect(cells[1].textContent).toContain("€");
    expect(cells[2].textContent).toBe("—");
  });

  it("flags a partial basket in the footer", () => {
    renderDialog();
    expect(screen.getByTestId("compare-footer-coverage").textContent).toBe(
      "comparePartialFooter(1|2)",
    );
  });

  it("keeps rows collapsed until asked, then expands all and remembers it", () => {
    renderDialog();
    expect(screen.queryByTestId("section-compare-note-row")).toBeNull();
    expect(screen.queryByTestId("compare-diff-legend")).toBeNull();

    fireEvent.click(screen.getByTestId("compare-diff-toggle"));

    // Both items have at least one quote, so both open.
    expect(screen.getAllByTestId("section-compare-note-row")).toHaveLength(2);
    expect(screen.getByTestId("compare-diff-legend")).toBeInTheDocument();
    expect(screen.getByTestId("compare-diff-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem(SHOW_DIFFERENCES_STORAGE_KEY)).toBe("1");
  });

  it("starts expanded when showDifferencesDefault is set and nothing is remembered", () => {
    renderDialog(true);
    expect(screen.getAllByTestId("section-compare-note-row")).toHaveLength(2);
  });

  it("lets the remembered choice win over showDifferencesDefault", () => {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, "0");
    renderDialog(true);
    expect(screen.queryByTestId("section-compare-note-row")).toBeNull();
  });

  it("opens a single row from its chevron without touching the remembered choice", () => {
    renderDialog();
    const rows = screen.getAllByTestId("section-compare-row");
    fireEvent.click(within(rows[0]).getByTestId("compare-row-toggle"));

    expect(screen.getAllByTestId("section-compare-note-row")).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("data-expanded", "true");
    expect(within(rows[0]).getByTestId("compare-row-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(localStorage.getItem(SHOW_DIFFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("shows both notes under an item with only the differing words marked", () => {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, "1");
    renderDialog();
    const panels = screen.getAllByTestId("section-compare-note-row");
    expect(panels).toHaveLength(2);
    const noteA = within(panels[0]).getByTestId("compare-note-a");
    const noteB = within(panels[0]).getByTestId("compare-note-b");
    const alphaMarks = [...noteA.querySelectorAll("mark")].map((m) => m.textContent);
    const bravoMarks = [...noteB.querySelectorAll("mark")].map((m) => m.textContent);
    expect(alphaMarks).toEqual(["radio", "42"]);
    expect(bravoMarks).toEqual(["filaire", "35"]);
    expect(noteA.textContent).toContain("Coulissant 1800×2200 VR Somfy radio, remise 42 %");
    // The cheaper side is labelled, the dearer one is not.
    expect(noteA.textContent).toContain("compareCheaperLabel");
    expect(noteB.textContent).not.toContain("compareCheaperLabel");
    // Gap sentence: Bravo is 2,00 € more per unit (+20 %), 2,00 € on 1 unit.
    expect(plain(within(panels[0]).getByTestId("compare-gap-explanation").textContent)).toBe(
      "compareGapExplanation(Bravo|Alpha|2,00 €|+20 %|2,00 €|1)",
    );
  });

  it("says 'no note' for a quote without one and 'no quote' where there is none", () => {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, "1");
    renderDialog();
    const panel = screen.getAllByTestId("section-compare-note-row")[1];
    // Item two: Alpha priced it with no note; Bravo has no quote at all.
    expect(within(panel).getByTestId("compare-note-a").textContent).toContain("compareNoNote");
    expect(within(panel).getByTestId("compare-note-b").textContent).toContain("compareNoQuote");
    expect(within(panel).queryByTestId("note-diff")).toBeNull();
    expect(within(panel).getByTestId("compare-gap-explanation").textContent).toBe(
      "compareUnpricedExplanation(Bravo)",
    );
  });
});
