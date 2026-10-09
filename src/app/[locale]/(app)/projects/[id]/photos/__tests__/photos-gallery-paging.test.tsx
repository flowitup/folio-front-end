/**
 * "Load more" paging of PhotosGallery after a photo is deleted.
 *
 * The list is offset-paginated (50 per page, newest capture first). Deleting a
 * loaded photo moves every later row up by one on the server, so asking for a
 * fixed "page + 1" skipped the row that slid into the previous page and left
 * "Load more" visible forever. The lightbox is stubbed so a test can delete a
 * photo directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhotosGallery } from "../photos-gallery";
import type { ProjectPhoto } from "@/lib/api/project-photos";

vi.mock("../actions", () => ({
  loadMorePhotosAction: vi.fn(),
}));

vi.mock("../photo-thumb", () => ({
  PhotoThumb: ({ photo }: { photo: ProjectPhoto }) => <span data-testid="thumb">{photo.id}</span>,
}));

vi.mock("../photos-upload", () => ({
  PhotosUpload: () => null,
}));

vi.mock("../photo-lightbox", () => ({
  PhotoLightbox: ({
    onDeleted,
    onUpdated,
  }: {
    onDeleted: (id: string) => void;
    onUpdated: (photo: ProjectPhoto) => void;
  }) => (
    <>
      <button type="button" onClick={() => onDeleted("p01")}>
        delete p01
      </button>
      <button type="button" onClick={() => onUpdated({ ...makePhoto(1), capturedAt: OLDEST })}>
        backdate p01
      </button>
    </>
  ),
}));

/** A capture date older than every fake photo. */
const OLDEST = "2000-01-01T00:00:00.000Z";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useFormatter: () => ({ dateTime: (date: Date) => date.toISOString().slice(0, 10) }),
}));

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function makePhoto(n: number): ProjectPhoto {
  const id = `p${String(n).padStart(2, "0")}`;
  return {
    id,
    projectId: PROJECT_ID,
    filename: `${id}.jpg`,
    contentType: "image/jpeg",
    sizeBytes: 4096,
    caption: null,
    // Newest first: p01 is the most recent capture
    capturedAt: new Date(Date.UTC(2026, 8, 1) - n * 60_000).toISOString(),
    uploadedAt: "2026-09-01T08:00:00Z",
    uploaderId: "uploader-1",
    thumbnailUrl: `/api/projects/${PROJECT_ID}/photos/${id}/thumbnail`,
    originalUrl: `/api/projects/${PROJECT_ID}/photos/${id}/original`,
  };
}

/** A fake server holding photos p01..p52, paged 50 at a time like the API. */
function fakeServer(count: number) {
  let rows = Array.from({ length: count }, (_, i) => makePhoto(i + 1));
  return {
    remove(id: string) {
      rows = rows.filter((p) => p.id !== id);
    },
    /** Give a photo a new capture date and re-sort newest first, like the API. */
    redate(id: string, capturedAt: string) {
      rows = rows
        .map((p) => (p.id === id ? { ...p, capturedAt } : p))
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    },
    page(page: number) {
      const items = rows.slice((page - 1) * 50, page * 50);
      return { ok: true as const, data: { items, total: rows.length, page, perPage: 50 } };
    },
  };
}

function shownIds(): string[] {
  return screen.getAllByTestId("thumb").map((el) => el.textContent ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PhotosGallery — Load more after a delete", () => {
  it("reaches every remaining photo and then hides Load more", async () => {
    const { loadMorePhotosAction } = await import("../actions");
    const server = fakeServer(52);
    vi.mocked(loadMorePhotosAction).mockImplementation(async (_projectId, page) => server.page(page));

    const first = server.page(1).data;
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={first.items}
        initialTotal={first.total}
        canEdit={true}
      />,
    );
    expect(shownIds()).toHaveLength(50);

    // Delete p01 (server side, then through the lightbox callback)
    server.remove("p01");
    fireEvent.click(screen.getByText("delete p01"));
    expect(shownIds()).toHaveLength(49);

    // p51 slid into page 1 on the server: the next load must not skip it
    fireEvent.click(screen.getByText("photos.loadMore"));
    await waitFor(() => expect(shownIds()).toContain("p51"));
    expect(loadMorePhotosAction).toHaveBeenLastCalledWith(PROJECT_ID, 1);
    expect(shownIds()).toHaveLength(50);

    fireEvent.click(screen.getByText("photos.loadMore"));
    await waitFor(() => expect(shownIds()).toHaveLength(51));
    expect(loadMorePhotosAction).toHaveBeenLastCalledWith(PROJECT_ID, 2);
    expect(shownIds()).toContain("p52");
    expect(shownIds()).not.toContain("p01");
    expect(screen.queryByText("photos.loadMore")).toBeNull();
  });

  it("does not skip a photo after a loaded photo is backdated past the loaded rows", async () => {
    const { loadMorePhotosAction } = await import("../actions");
    const server = fakeServer(52);
    vi.mocked(loadMorePhotosAction).mockImplementation(async (_projectId, page) => server.page(page));

    const first = server.page(1).data;
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={first.items}
        initialTotal={first.total}
        canEdit={true}
      />,
    );

    // p01 moves to the end of the server order, so p51 slides into page 1
    server.redate("p01", OLDEST);
    fireEvent.click(screen.getByText("backdate p01"));

    fireEvent.click(screen.getByText("photos.loadMore"));
    await waitFor(() => expect(shownIds()).toContain("p51"));
    expect(loadMorePhotosAction).toHaveBeenLastCalledWith(PROJECT_ID, 1);

    fireEvent.click(screen.getByText("photos.loadMore"));
    await waitFor(() => expect(shownIds()).toHaveLength(52));
    expect(shownIds()).toContain("p52");
    expect(screen.queryByText("photos.loadMore")).toBeNull();
  });

  it("asks for page 2 when nothing was deleted", async () => {
    const { loadMorePhotosAction } = await import("../actions");
    const server = fakeServer(52);
    vi.mocked(loadMorePhotosAction).mockImplementation(async (_projectId, page) => server.page(page));

    const first = server.page(1).data;
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={first.items}
        initialTotal={first.total}
        canEdit={true}
      />,
    );

    fireEvent.click(screen.getByText("photos.loadMore"));
    await waitFor(() => expect(shownIds()).toHaveLength(52));
    expect(loadMorePhotosAction).toHaveBeenCalledTimes(1);
    expect(loadMorePhotosAction).toHaveBeenCalledWith(PROJECT_ID, 2);
    expect(screen.queryByText("photos.loadMore")).toBeNull();
  });
});
