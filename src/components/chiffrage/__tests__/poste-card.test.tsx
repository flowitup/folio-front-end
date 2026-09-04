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
  onCompare?: () => void;
  posteOver?: Partial<ChiffragePoste>;
} = {}) =>
  render(
    <PosteCard
      poste={poste(over.posteOver)}
      canManage
      collapsed={over.collapsed ?? false}
      onToggleCollapse={over.onToggleCollapse ?? (() => {})}
      canCompare={over.canCompare ?? false}
      onCompare={over.onCompare ?? (() => {})}
      onEdit={() => {}}
      onDelete={() => {}}
      onAddArticle={() => {}}
    >
      <div data-testid="poste-body">items</div>
    </PosteCard>,
  );

describe("PosteCard collapse", () => {
  it("shows the body when open", () => {
    renderCard({ collapsed: false });
    expect(screen.getByTestId("poste-body")).toBeInTheDocument();
  });

  it("hides the body when collapsed, keeping the header and subtotal", () => {
    renderCard({ collapsed: true });
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
        onCompare={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddArticle={() => {}}
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

describe("PosteCard shop comparison", () => {
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
        onCompare={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddArticle={() => {}}
      >
        <div data-testid="poste-body">items</div>
      </PosteCard>,
    );
    expect(
      screen.getByRole("button", { name: "compareToggle" }),
    ).toBeInTheDocument();
  });

  it("stays available even when the section body is collapsed", () => {
    // The Compare button opens a modal, so it must not be gated behind the
    // collapse toggle — you can compare a section without expanding it.
    renderCard({ collapsed: true, canCompare: true });
    expect(
      screen.getByRole("button", { name: "compareToggle" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("poste-body")).toBeNull();
  });

  it("asks the parent to open the comparison when clicked", async () => {
    const onCompare = vi.fn();
    renderCard({ canCompare: true, onCompare });
    await userEvent.click(
      screen.getByRole("button", { name: "compareToggle" }),
    );
    expect(onCompare).toHaveBeenCalledTimes(1);
  });
});
