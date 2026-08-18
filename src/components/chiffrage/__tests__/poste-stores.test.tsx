/**
 * poste-stores.test.tsx
 *
 * A poste holds a run of shops, not a single address. These pin that every
 * shop is listed, that the map link is built from the address (falling back to
 * the name when no address was recorded), and that a read-only member sees the
 * addresses but none of the editing controls.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PosteStores, mapsUrl } from "../poste-stores";
import type { ChiffrageStore } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const store = (over: Partial<ChiffrageStore> = {}): ChiffrageStore => ({
  id: "s1",
  poste_id: "p1",
  name: "Leroy Merlin Ivry",
  address: "45 av de Verdun, 94200 Ivry-sur-Seine",
  position: 1000,
  ...over,
});

const STORES = [
  store(),
  store({ id: "s2", name: "Point P Vitry", address: "12 rue Charles Fourier", position: 2000 }),
  store({ id: "s3", name: "Rexel Paris 13", address: null, position: 3000 }),
];

describe("PosteStores", () => {
  it("lists every shop of the poste, not just the first", () => {
    render(
      <PosteStores stores={STORES} canManage onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getAllByTestId("poste-store")).toHaveLength(3);
    expect(screen.getByText("Leroy Merlin Ivry")).toBeInTheDocument();
    expect(screen.getByText("Point P Vitry")).toBeInTheDocument();
    expect(screen.getByText("Rexel Paris 13")).toBeInTheDocument();
  });

  it("shows the address under each shop that has one", () => {
    render(
      <PosteStores stores={STORES} canManage onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByText("45 av de Verdun, 94200 Ivry-sur-Seine")).toBeInTheDocument();
    expect(screen.getByText("12 rue Charles Fourier")).toBeInTheDocument();
  });

  it("builds the map link from the address so it lands on the right branch", () => {
    const url = mapsUrl(store());
    expect(url).toContain(encodeURIComponent("45 av de Verdun, 94200 Ivry-sur-Seine"));
  });

  it("falls back to the shop name when no address was recorded", () => {
    const url = mapsUrl(store({ address: null, name: "Rexel Paris 13" }));
    expect(url).toContain(encodeURIComponent("Rexel Paris 13"));
  });

  it("opens the map in a new tab without leaking the referrer", () => {
    render(
      <PosteStores stores={STORES} canManage onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );
    const link = screen.getByRole("link", { name: /Leroy Merlin Ivry/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("hides every editing control from a read-only member", () => {
    render(
      <PosteStores
        stores={STORES}
        canManage={false}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    // The addresses stay readable — only the controls go.
    expect(screen.getByText("Leroy Merlin Ivry")).toBeInTheDocument();
    expect(screen.queryByText("addStore")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("editStore")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("deleteStore")).not.toBeInTheDocument();
  });

  it("renders nothing for a read-only member when the poste has no shop", () => {
    const { container } = render(
      <PosteStores stores={[]} canManage={false} onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("invites a manager to add the first shop", () => {
    render(<PosteStores stores={[]} canManage onAdd={() => {}} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("noStoresYet")).toBeInTheDocument();
    expect(screen.getByText("addStore")).toBeInTheDocument();
  });

  it("routes edit and delete to the right shop", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <PosteStores stores={STORES} canManage onAdd={() => {}} onEdit={onEdit} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getAllByLabelText("editStore")[1]);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ name: "Point P Vitry" }));

    await userEvent.click(screen.getAllByLabelText("deleteStore")[2]);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: "Rexel Paris 13" }));
  });
});
