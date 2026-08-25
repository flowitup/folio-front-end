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
        onEdit={noop}
        onDelete={noop}
      />
    );

    const rows = screen.getAllByTestId("quote-row");
    expect(within(rows[0]).getByText("—")).toBeInTheDocument();
    expect(within(rows[1]).getByText("+15 %")).toBeInTheDocument();
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
        onEdit={noop}
        onDelete={noop}
      />
    );

    expect(screen.queryByText("retain")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("editQuote")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("deleteQuote")).not.toBeInTheDocument();
  });

  it("cannot re-select the quote that is already retained", async () => {
    const onSelect = vi.fn();
    const retained = quote({ id: "retained", is_selected: true });

    render(
      <QuoteComparisonTable
        article={article([retained])}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={onSelect}
        onEdit={noop}
        onDelete={noop}
      />
    );

    const button = screen.getByTitle("retainThisQuote");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("invites the user to add a price when the article has none", () => {
    render(
      <QuoteComparisonTable
        article={article([], { effective_quote_id: null, effective_source: "none", total_ht: 0, total_ttc: 0 })}
        stores={[]}
        canManage
        busyQuoteId={null}
        onSelect={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("noQuotesYet")).toBeInTheDocument();
  });
});
