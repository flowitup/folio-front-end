/**
 * poste-card.test.tsx
 *
 * A section can be collapsed to hide its body (shops + items) while keeping the
 * header and subtotal in view. These pin that the body only renders when the
 * section is open, that the toggle reports its state through aria-expanded, and
 * that clicking it asks the parent to flip that state.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PosteCard } from "../poste-card";
import type { ChiffragePoste } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const poste = (over: Partial<ChiffragePoste> = {}): ChiffragePoste => ({
  id: "p1",
  project_id: "proj1",
  name: "Lighting",
  note: null,
  position: 1000,
  articles: [
    {
      id: "a1",
      poste_id: "p1",
      name: "Ceiling spot",
      quantity: 3,
      unit: null,
      note: null,
      room_id: null,
      position: 1000,
      quotes: [],
      image_ref: null,
      effective_quote_id: null,
      effective_source: "none",
      total_ht: 0,
      total_ttc: 0,
    },
  ],
  store_baskets: [],
  room_subtotals: [],
  subtotal_ht: 3750,
  subtotal_ttc: 4500,
  ...over,
});

const renderCard = (over: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  canCompare?: boolean;
  comparing?: boolean;
  onToggleCompare?: () => void;
  posteOver?: Partial<ChiffragePoste>;
} = {}) =>
  render(
    <PosteCard
      poste={poste(over.posteOver)}
      canManage
      collapsed={over.collapsed ?? false}
      onToggleCollapse={over.onToggleCollapse ?? (() => {})}
      canCompare={over.canCompare ?? false}
      comparing={over.comparing ?? false}
      onToggleCompare={over.onToggleCompare ?? (() => {})}
      onEdit={() => {}}
      onDelete={() => {}}
      onAddArticle={() => {}}
      stores={<div data-testid="poste-shops">shops</div>}
      compare={<div data-testid="poste-compare">compare</div>}
    >
      <div data-testid="poste-body">items</div>
    </PosteCard>,
  );

describe("PosteCard collapse", () => {
  it("shows the body when open", () => {
    renderCard({ collapsed: false });
    expect(screen.getByTestId("poste-shops")).toBeInTheDocument();
    expect(screen.getByTestId("poste-body")).toBeInTheDocument();
  });

  it("hides the body when collapsed, keeping the header and subtotal", () => {
    renderCard({ collapsed: true });
    expect(screen.queryByTestId("poste-shops")).not.toBeInTheDocument();
    expect(screen.queryByTestId("poste-body")).not.toBeInTheDocument();
    // The header still names the section and shows its running total.
    expect(screen.getByText("Lighting")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lighting" })).toBeInTheDocument();
  });

  it("reports its open/closed state through aria-expanded", () => {
    const { rerender } = renderCard({ collapsed: false });
    const open = screen.getByLabelText("collapseSection");
    expect(open).toHaveAttribute("aria-expanded", "true");

    rerender(
      <PosteCard
        poste={poste()}
        canManage
        collapsed
        onToggleCollapse={() => {}}
        canCompare={false}
        comparing={false}
        onToggleCompare={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddArticle={() => {}}
        stores={<div data-testid="poste-shops">shops</div>}
        compare={<div data-testid="poste-compare">compare</div>}
      >
        <div data-testid="poste-body">items</div>
      </PosteCard>,
    );
    const closed = screen.getByLabelText("expandSection");
    expect(closed).toHaveAttribute("aria-expanded", "false");
  });

  it("asks the parent to toggle when the control is clicked", async () => {
    const onToggleCollapse = vi.fn();
    renderCard({ collapsed: false, onToggleCollapse });
    await userEvent.click(screen.getByLabelText("collapseSection"));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("stays collapsible even when the section has no items", () => {
    renderCard({ collapsed: true, posteOver: { articles: [] } });
    expect(screen.queryByText("noArticlesYet")).not.toBeInTheDocument();
    expect(screen.getByLabelText("expandSection")).toBeInTheDocument();
  });
});

describe("PosteCard shop comparison toggle", () => {
  it("offers the Compare control only when the section has baskets", () => {
    const { rerender } = renderCard({ canCompare: false });
    expect(screen.queryByRole("button", { name: "compareToggle" })).toBeNull();

    rerender(
      <PosteCard
        poste={poste()}
        canManage
        collapsed={false}
        onToggleCollapse={() => {}}
        canCompare
        comparing={false}
        onToggleCompare={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddArticle={() => {}}
        stores={<div data-testid="poste-shops">shops</div>}
        compare={<div data-testid="poste-compare">compare</div>}
      >
        <div data-testid="poste-body">items</div>
      </PosteCard>,
    );
    expect(
      screen.getByRole("button", { name: "compareToggle" }),
    ).toBeInTheDocument();
  });

  it("shows the comparison only while expanded, and reports state via aria-pressed", () => {
    const { rerender } = renderCard({ canCompare: true, comparing: false });
    expect(screen.queryByTestId("poste-compare")).toBeNull();
    expect(
      screen.getByRole("button", { name: "compareToggle" }),
    ).toHaveAttribute("aria-pressed", "false");

    rerender(
      <PosteCard
        poste={poste()}
        canManage
        collapsed={false}
        onToggleCollapse={() => {}}
        canCompare
        comparing
        onToggleCompare={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddArticle={() => {}}
        stores={<div data-testid="poste-shops">shops</div>}
        compare={<div data-testid="poste-compare">compare</div>}
      >
        <div data-testid="poste-body">items</div>
      </PosteCard>,
    );
    expect(screen.getByTestId("poste-compare")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "compareToggle" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the comparison visible even when the section body is collapsed", () => {
    // The Compare toggle stands on its own — you should not have to expand the
    // whole section to read its shop comparison.
    renderCard({ collapsed: true, canCompare: true, comparing: true });
    expect(screen.getByTestId("poste-compare")).toBeInTheDocument();
    expect(screen.queryByTestId("poste-body")).toBeNull();
  });

  it("asks the parent to toggle when the Compare control is clicked", async () => {
    const onToggleCompare = vi.fn();
    renderCard({ canCompare: true, onToggleCompare });
    await userEvent.click(
      screen.getByRole("button", { name: "compareToggle" }),
    );
    expect(onToggleCompare).toHaveBeenCalledTimes(1);
  });
});
