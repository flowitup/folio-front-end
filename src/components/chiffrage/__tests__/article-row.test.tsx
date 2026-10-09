/**
 * article-row.test.tsx
 *
 * On a phone the item's name block is only a few dozen pixels wide, between
 * the thumbnail, the amounts and the action buttons. A status badge that could
 * not wrap ("Auto · moins cher") spilled out of it and was drawn over the TTC
 * amount. jsdom has no layout, so this pins the class facts that keep the
 * badges inside their block.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ArticleRow } from "../article-row";
import type { ChiffrageArticle } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../article-image", () => ({ ArticleImage: () => null }));

function article(overrides: Partial<ChiffrageArticle> = {}): ChiffrageArticle {
  return {
    id: "a1",
    poste_id: "p1",
    name: "Vis",
    quantity: 1,
    unit: null,
    note: null,
    position: 1000,
    quotes: [],
    image_ref: null,
    room_id: null,
    effective_quote_id: null,
    effective_source: "none",
    total_ht: 7.5,
    total_ttc: 9,
    ...overrides,
  };
}

const noop = () => {};

function renderRow(a: ChiffrageArticle) {
  render(
    <ArticleRow
      article={a}
      stores={[]}
      projectId="proj1"
      canManage
      expanded={false}
      busyQuoteId={null}
      onToggle={noop}
      onEdit={noop}
      onDelete={noop}
      onAddQuote={noop}
      onManageImage={noop}
      imageVersion={0}
      onSelectQuote={noop}
      onUnselectQuote={noop}
      onEditQuote={noop}
      onDeleteQuote={noop}
    />,
  );
}

describe("ArticleRow status badges on a narrow screen", () => {
  it.each([
    ["cheapest", "autoCheapest"],
    ["selected", "retained"],
    ["none", "noPrice"],
  ] as const)("lets the %s badge wrap inside the name block", (source, label) => {
    renderRow(article({ effective_source: source }));
    const badge = screen.getByText(label);
    expect(badge.className).toMatch(/\bmax-w-full\b/);
    expect(badge.className).toMatch(/\bwhitespace-normal\b/);
    expect(badge.className).not.toMatch(/\bwhitespace-nowrap\b/);
  });
});
