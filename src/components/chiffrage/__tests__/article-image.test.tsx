/**
 * article-image.test.tsx
 *
 * The thumbnail is fetched as a Blob from the API, never rendered from an
 * external URL — the production CSP would block a supplier CDN outright. These
 * pin which endpoint each image_ref kind resolves to, and that a missing image
 * degrades to a placeholder rather than a broken picture.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { ArticleImage } from "../article-image";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "https://api.test/api/v1" },
}));

const PROJECT = "p-1";

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:fake") as never;
  global.URL.revokeObjectURL = vi.fn() as never;
});
afterEach(() => vi.restoreAllMocks());

function mockFetchOk() {
  const spy = vi
    .fn()
    .mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) });
  global.fetch = spy as never;
  return spy;
}

describe("ArticleImage", () => {
  it("shows a placeholder when the article has no image", () => {
    render(<ArticleImage projectId={PROJECT} imageRef={null} alt="Spot" />);
    expect(screen.getByTestId("article-image-placeholder")).toBeInTheDocument();
  });

  it("fetches the article's own photo from the chiffrage endpoint", async () => {
    const spy = mockFetchOk();
    render(
      <ArticleImage
        projectId={PROJECT}
        imageRef={{ kind: "article", id: "a-1" }}
        alt="Spot"
      />,
    );
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0][0]).toBe(
      "https://api.test/api/v1/projects/p-1/chiffrage/articles/a-1/image",
    );
    expect(spy.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("borrows the library product's photo when that is the ref", async () => {
    const spy = mockFetchOk();
    render(
      <ArticleImage
        projectId={PROJECT}
        imageRef={{ kind: "library", id: "lp-9" }}
        alt="Spot"
      />,
    );
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0][0]).toBe(
      "https://api.test/api/v1/bibliotheque/products/lp-9/image",
    );
  });

  it("renders the thumbnail from a blob URL once loaded", async () => {
    mockFetchOk();
    render(
      <ArticleImage
        projectId={PROJECT}
        imageRef={{ kind: "article", id: "a-1" }}
        alt="Spot"
      />,
    );
    const thumb = await screen.findByTestId("article-image-thumb");
    expect(thumb.querySelector("img")).toHaveAttribute("src", "blob:fake");
    expect(thumb.querySelector("img")).toHaveAttribute("alt", "Spot");
  });

  it("falls back to the placeholder when the fetch fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as never;
    render(
      <ArticleImage
        projectId={PROJECT}
        imageRef={{ kind: "article", id: "a-1" }}
        alt="Spot"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("article-image-placeholder"),
      ).toBeInTheDocument(),
    );
  });

  it("refetches when the version is bumped after an upload", async () => {
    const spy = mockFetchOk();
    const ref = { kind: "article", id: "a-1" } as const;
    const { rerender } = render(
      <ArticleImage
        projectId={PROJECT}
        imageRef={ref}
        alt="Spot"
        version={0}
      />,
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    rerender(
      <ArticleImage
        projectId={PROJECT}
        imageRef={ref}
        alt="Spot"
        version={1}
      />,
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
