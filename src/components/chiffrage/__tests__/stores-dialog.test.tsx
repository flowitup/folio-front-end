/**
 * stores-dialog.test.tsx
 *
 * Shops are declared once per project and every price points at one. These pin
 * that each shop is listed with a map link built from its address (or its name
 * when none was recorded), that only a real web address becomes a website
 * link, that editing and adding hand over to the form, and that deleting asks
 * first and locks the list until it is done.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StoresDialog, mapsUrl, websiteHref } from "../stores-dialog";
import type { ChiffrageStore } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

const store = (over: Partial<ChiffrageStore> = {}): ChiffrageStore => ({
  id: "s1",
  project_id: "proj1",
  name: "Leroy Merlin Ivry",
  address: "45 av de Verdun, 94200 Ivry-sur-Seine",
  website_url: "https://www.leroymerlin.fr/magasin/ivry",
  position: 1000,
  ...over,
});

const STORES = [
  store(),
  store({
    id: "s2",
    name: "Rexel Paris 13",
    address: null,
    website_url: null,
    position: 2000,
  }),
];

function renderDialog(
  over: Partial<React.ComponentProps<typeof StoresDialog>> = {},
) {
  const props = {
    open: true,
    stores: STORES,
    onOpenChange: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(true),
    ...over,
  };
  render(<StoresDialog {...props} />);
  return props;
}

const rows = () => screen.getAllByTestId("store-row");

describe("StoresDialog", () => {
  let confirmSpy: MockInstance<(message?: string) => boolean>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("lists every shop of the project with its address", () => {
    renderDialog();
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent("Leroy Merlin Ivry");
    expect(rows()[0]).toHaveTextContent(
      "45 av de Verdun, 94200 Ivry-sur-Seine",
    );
    expect(rows()[1]).toHaveTextContent("Rexel Paris 13");
  });

  it("says so when no shop was declared yet", () => {
    renderDialog({ stores: [] });
    expect(screen.getByTestId("stores-empty")).toHaveTextContent("noStoresYet");
  });

  it("opens the shop in a map in a new tab without leaking the referrer", () => {
    renderDialog();
    const link = within(rows()[0]).getByRole("link", {
      name: /Leroy Merlin Ivry/,
    });
    expect(link).toHaveAttribute("href", mapsUrl(STORES[0]));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("links to the website only for a shop that has one", () => {
    renderDialog();
    expect(within(rows()[0]).getByLabelText("openWebsite")).toHaveAttribute(
      "href",
      "https://www.leroymerlin.fr/magasin/ivry",
    );
    expect(
      within(rows()[1]).queryByLabelText("openWebsite"),
    ).not.toBeInTheDocument();
  });

  it("hands the shop to the form for editing", async () => {
    const { onEdit } = renderDialog();
    await userEvent.click(within(rows()[1]).getByLabelText("editStore"));
    expect(onEdit).toHaveBeenCalledWith(STORES[1]);
  });

  it("opens the form for a new shop", async () => {
    const { onAdd } = renderDialog({ stores: [] });
    await userEvent.click(screen.getByRole("button", { name: "addStore" }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("asks before deleting a shop, naming it", async () => {
    const { onDelete } = renderDialog();
    await userEvent.click(within(rows()[0]).getByLabelText("deleteStore"));
    expect(confirmSpy).toHaveBeenCalledWith(
      "confirmDeleteStore:Leroy Merlin Ivry",
    );
    expect(onDelete).toHaveBeenCalledWith(STORES[0]);
  });

  it("deletes nothing when the confirmation is declined", async () => {
    confirmSpy.mockReturnValue(false);
    const { onDelete } = renderDialog();
    await userEvent.click(within(rows()[0]).getByLabelText("deleteStore"));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("locks the list while a deletion is being saved", async () => {
    let finish: (value: boolean) => void = () => {};
    const onDelete = vi.fn(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    renderDialog({ onDelete });

    await userEvent.click(within(rows()[0]).getByLabelText("deleteStore"));
    expect(within(rows()[1]).getByLabelText("deleteStore")).toBeDisabled();
    expect(within(rows()[1]).getByLabelText("editStore")).toBeDisabled();
    expect(screen.getByRole("button", { name: "addStore" })).toBeDisabled();

    finish(false);
    await waitFor(() =>
      expect(within(rows()[1]).getByLabelText("deleteStore")).toBeEnabled(),
    );
  });
});

describe("mapsUrl", () => {
  it("searches the address so it lands on the right branch", () => {
    expect(mapsUrl(store())).toContain(
      encodeURIComponent("45 av de Verdun, 94200 Ivry-sur-Seine"),
    );
  });

  it("falls back to the shop name when no address was recorded", () => {
    expect(mapsUrl(store({ address: null, name: "Rexel Paris 13" }))).toContain(
      encodeURIComponent("Rexel Paris 13"),
    );
  });
});

describe("websiteHref", () => {
  it("keeps an http(s) address as it is", () => {
    expect(websiteHref("https://www.pointp.fr")).toBe("https://www.pointp.fr");
    expect(websiteHref("http://example.fr/shop")).toBe(
      "http://example.fr/shop",
    );
  });

  it("adds a scheme to a bare domain so it does not open inside the app", () => {
    expect(websiteHref("www.leroymerlin.fr")).toBe(
      "https://www.leroymerlin.fr",
    );
  });

  it("links nothing for an empty value or another scheme", () => {
    expect(websiteHref(null)).toBeNull();
    expect(websiteHref("   ")).toBeNull();
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("mailto:contact@shop.fr")).toBeNull();
  });
});
