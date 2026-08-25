/**
 * poste-stores.test.tsx
 *
 * A section's shop run is derived from the prices recorded on its items, so
 * this component only displays — adding and removing shops is a project-level
 * concern now. These pin that every shop passed in is listed, that the map link
 * is built from the address (falling back to the name when none was recorded),
 * and that a read-only member sees the addresses but no editing control.
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
  project_id: "proj1",
  name: "Leroy Merlin Ivry",
  address: "45 av de Verdun, 94200 Ivry-sur-Seine",
  website_url: null,
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
      <PosteStores stores={STORES} canManage onEdit={() => {}} />,
    );
    expect(screen.getAllByTestId("poste-store")).toHaveLength(3);
    expect(screen.getByText("Leroy Merlin Ivry")).toBeInTheDocument();
    expect(screen.getByText("Point P Vitry")).toBeInTheDocument();
    expect(screen.getByText("Rexel Paris 13")).toBeInTheDocument();
  });

  it("shows the address under each shop that has one", () => {
    render(
      <PosteStores stores={STORES} canManage onEdit={() => {}} />,
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
      <PosteStores stores={STORES} canManage onEdit={() => {}} />,
    );
    const link = screen.getByRole("link", { name: /Leroy Merlin Ivry/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("links to the shop's website when one is recorded", () => {
    render(
      <PosteStores
        stores={[store({ website_url: "https://www.leroymerlin.fr/magasin/ivry" })]}
        canManage
        onEdit={() => {}}
      />,
    );
    const link = screen.getByLabelText("openWebsite");
    expect(link).toHaveAttribute("href", "https://www.leroymerlin.fr/magasin/ivry");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows no website link when none was recorded", () => {
    render(
      <PosteStores stores={[store()]} canManage onEdit={() => {}} />,
    );
    expect(screen.queryByLabelText("openWebsite")).not.toBeInTheDocument();
  });

  it("keeps the website reachable for a read-only member", () => {
    // The map and website links are information, not editing — they stay.
    render(
      <PosteStores
        stores={[store({ website_url: "https://www.pointp.fr" })]}
        canManage={false}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByLabelText("openWebsite")).toBeInTheDocument();
    expect(screen.queryByLabelText("editStore")).not.toBeInTheDocument();
  });

  it("does not nest the website link inside the map link", () => {
    // Nested anchors are invalid HTML and would eat the map tap target.
    render(
      <PosteStores
        stores={[store({ website_url: "https://www.pointp.fr" })]}
        canManage
        onEdit={() => {}}
      />,
    );
    const web = screen.getByLabelText("openWebsite");
    expect(web.closest("a")).toBe(web);
  });

  it("hides every editing control from a read-only member", () => {
    render(
      <PosteStores
        stores={STORES}
        canManage={false}
        onEdit={() => {}}
      />,
    );
    // The addresses stay readable — only the controls go.
    expect(screen.getByText("Leroy Merlin Ivry")).toBeInTheDocument();
    expect(screen.queryByLabelText("editStore")).not.toBeInTheDocument();
  });

  it("renders nothing for a read-only member when the poste has no shop", () => {
    const { container } = render(
      <PosteStores stores={[]} canManage={false} onEdit={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("invites a manager to add the first shop", () => {
    render(<PosteStores stores={[]} canManage onEdit={() => {}} />);
    expect(screen.getByText("noShopPricedHere")).toBeInTheDocument();
  });

  it("routes edit to the right shop", async () => {
    const onEdit = vi.fn();
    render(<PosteStores stores={STORES} canManage onEdit={onEdit} />);
    await userEvent.click(screen.getAllByLabelText("editStore")[1]);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ name: "Point P Vitry" }));
  });
});
