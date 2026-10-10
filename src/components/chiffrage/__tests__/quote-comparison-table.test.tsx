/**
 * quote-comparison-table.test.tsx
 *
 * The comparison table is where a supplier is chosen, so these pin the things
 * that would mislead that decision: which row counts, what the delta says, and
 * whether a read-only viewer is shown controls they cannot use.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuoteComparisonTable } from "../quote-comparison-table";
import type { ChiffrageArticle, ChiffrageQuote } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function quote(overrides: Partial<ChiffrageQuote> = {}): ChiffrageQuote {
  return {
    id: "q1",
    article_id: "a1",
    store_id: null,
  supplier_id: null,
    supplier_name: "Leroy Merlin",
    library_product_id: null,
    unit_price_ht: 10.75,
    tva_rate: 20,
    unit_price_ttc: 12.9,
    product_url: null,
    note: null,
    is_selected: false,
    ...overrides,
  };
}

function article(quotes: ChiffrageQuote[], overrides: Partial<ChiffrageArticle> = {}): ChiffrageArticle {
  const effective = quotes.find((q) => q.is_selected) ?? quotes[0] ?? null;
  return {
    id: "a1",
    poste_id: "p1",
    name: "Spot encastré",
    quantity: 12,
    unit: "u",
    note: null,
    position: 1000,
    quotes,
    image_ref: null,
    room_id: null,
    effective_quote_id: effective?.id ?? null,
    effective_source: effective ? (effective.is_selected ? "selected" : "cheapest") : "none",
    total_ht: 129,
    total_ttc: 154.8,
    ...overrides,
  };
}

const noop = () => {};

describe("QuoteComparisonTable", () => {
  it("marks the effective quote so the reader knows which price counts", () => {
    const cheap = quote({ id: "cheap", unit_price_ht: 10.75 });
    const dear = quote({ id: "dear", supplier_name: "Point P", unit_price_ht: 12.4, unit_price_ttc: 14.88 });

    render(
      <QuoteComparisonTable
        article={article([cheap, dear])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    const rows = screen.getAllByTestId("quote-row");
    expect(rows[0]).toHaveAttribute("data-effective", "true");
    expect(rows[1]).toHaveAttribute("data-effective", "false");
  });

  it("shows the premium of every dearer offer against the cheapest", () => {
    const cheap = quote({ id: "cheap", unit_price_ht: 10 });
    const dear = quote({ id: "dear", supplier_name: "Point P", unit_price_ht: 11.5 });

    render(
      <QuoteComparisonTable
        article={article([cheap, dear])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    const rows = screen.getAllByTestId("quote-row");
    expect(within(rows[0]).getByText("—")).toBeInTheDocument();
    expect(within(rows[1]).getByText("+15 %")).toBeInTheDocument();
  });

  it("shows a 4-decimal price to the cent and treats prices that read the same as equal", () => {
    const a = quote({ id: "a", unit_price_ht: 12.3456 });
    const b = quote({ id: "b", supplier_name: "Point P", unit_price_ht: 12.3499 });

    render(
      <QuoteComparisonTable
        article={article([a, b])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    const rows = screen.getAllByTestId("quote-row");
    expect(rows[0].textContent).toMatch(/12,35\s€/);
    expect(rows[0].textContent).not.toMatch(/12,3456/);
    // Neither shows a "+0 %" premium over the other.
    expect(screen.queryByText("+0 %")).toBeNull();
  });

  it("distinguishes a deliberate pick from the automatic fallback", () => {
    const cheap = quote({ id: "cheap", unit_price_ht: 10.75 });
    const retained = quote({ id: "retained", supplier_name: "Rexel", unit_price_ht: 11.9, is_selected: true });

    render(
      <QuoteComparisonTable
        article={article([cheap, retained])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    const rows = screen.getAllByTestId("quote-row");
    const retainedRow = rows.find((r) => r.textContent?.includes("Rexel"))!;
    expect(within(retainedRow).getByText("retained")).toBeInTheDocument();
    // The cheapest is still labelled as such, but no longer drives the budget.
    const cheapRow = rows.find((r) => r.textContent?.includes("Leroy Merlin"))!;
    expect(within(cheapRow).getByText("cheapest")).toBeInTheDocument();
    expect(cheapRow).toHaveAttribute("data-effective", "false");
  });

  it("hides every mutating control from a read-only viewer", () => {
    render(
      <QuoteComparisonTable
        article={article([quote()])}
        stores={[]}
        canManage={false}
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    expect(screen.queryByText("retain")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("editQuote")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("deleteQuote")).not.toBeInTheDocument();
  });

  it("un-retains the retained quote instead of re-selecting it", async () => {
    const onSelect = vi.fn();
    const onUnselect = vi.fn();
    const retained = quote({ id: "retained", is_selected: true });
    const other = quote({ id: "other", supplier_name: "Point P", unit_price_ht: 9 });

    render(
      <QuoteComparisonTable
        article={article([retained, other])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={onSelect}
        onUnselect={onUnselect}
        onEdit={noop}
        onDelete={noop}
      />
    );

    // Round 1 left the retained row with a dead button and no way back to
    // the automatic cheapest choice short of deleting the price.
    const [retainedRow, otherRow] = screen.getAllByTestId("quote-row");
    const unretain = within(retainedRow).getByTitle("unretainThisQuote");
    expect(unretain).toBeEnabled();
    expect(unretain).toHaveTextContent("unretain");
    expect(within(retainedRow).queryByTitle("retainThisQuote")).not.toBeInTheDocument();
    await userEvent.click(unretain);
    expect(onUnselect).toHaveBeenCalledWith(retained);
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.click(within(otherRow).getByTitle("retainThisQuote"));
    expect(onSelect).toHaveBeenCalledWith(other);
  });

  it("disables the un-retain button while that quote is being saved", () => {
    const retained = quote({ id: "retained", is_selected: true });
    render(
      <QuoteComparisonTable
        article={article([retained])}
        stores={[]}
        canManage
        busyQuoteId="retained"
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByTitle("unretainThisQuote")).toBeDisabled();
  });

  it("invites the user to add a price when the article has none", () => {
    render(
      <QuoteComparisonTable
        article={article([], { effective_quote_id: null, effective_source: "none", total_ht: 0, total_ttc: 0 })}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("noQuotesYet")).toBeInTheDocument();
  });

  it("highlights what one quote's note says that the other's does not", () => {
    render(
      <QuoteComparisonTable
        article={article([
          quote({ id: "q1", note: "Coulissant 1800×2200, VR Somfy radio, remise 42 %" }),
          quote({ id: "q2", supplier_name: "Point P", note: "Coulissant 1800×2200, VR Somfy filaire, remise 38 %" }),
        ])}
        stores={[]}
        canManage={false}
        busyQuoteId={null}
        onSelect={() => {}}
        onUnselect={noop}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const rows = screen.getAllByTestId("quote-row");
    const marks = (row: HTMLElement) =>
      within(row).getAllByTestId("note-diff").map((m) => m.textContent);
    expect(marks(rows[0])).toEqual(["radio", "42"]);
    expect(marks(rows[1])).toEqual(["filaire", "38"]);
    expect(screen.getByTestId("quote-note-diff-legend")).toBeInTheDocument();
  });

  it("shows a lone note plainly, with no highlight and no legend", () => {
    render(
      <QuoteComparisonTable
        article={article([quote({ id: "q1", note: "VR Somfy radio" })])}
        stores={[]}
        canManage={false}
        busyQuoteId={null}
        onSelect={() => {}}
        onUnselect={noop}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText("VR Somfy radio")).toBeInTheDocument();
    expect(screen.queryByTestId("note-diff")).toBeNull();
    expect(screen.queryByTestId("quote-note-diff-legend")).toBeNull();
  });
});

describe("QuoteComparisonTable on a phone", () => {
  // jsdom has no layout, so pin the two class facts that keep the 640px table
  // inside its scroller: no absolutely positioned (sr-only) header cell, and a
  // positioned scroll wrapper.
  it("keeps the wide table inside its own scroller", () => {
    render(
      <QuoteComparisonTable
        article={article([quote()])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    const table = screen.getByTestId("quote-comparison-table");
    expect(table.parentElement!.className).toMatch(/\brelative\b/);
    for (const th of table.querySelectorAll("th")) {
      expect(th.className).not.toMatch(/\bsr-only\b/);
    }
    expect(screen.getByText("actions").className).toContain("sr-only");
  });
});

describe("QuoteComparisonTable VAT column", () => {
  it("formats the rate like the amounts beside it (5,5 %, not 5.5%)", () => {
    render(
      <QuoteComparisonTable
        article={article([quote({ tva_rate: 5.5, unit_price_ttc: 11.34 })])}
        stores={[]}
        canManage={false}
        busyQuoteId={null}
        onSelect={noop}
        onUnselect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    const row = screen.getByTestId("quote-row");
    // Intl puts a narrow no-break space before "%".
    expect(within(row).getByText(/^5,5\s%$/)).toBeInTheDocument();
    expect(row.textContent).not.toContain("5.5%");
  });
});
