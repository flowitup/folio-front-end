/**
 * Tests for ProjectCoverPhotos — the latest-photos montage cover on project
 * cards. Proves it renders a tile per loaded thumbnail when the project has
 * photos, and renders nothing (gradient shows through) when it has none.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProjectCoverPhotos } from "../project-cover-photos";

vi.mock("@/app/[locale]/(app)/projects/cover-photos-actions", () => ({
  loadLatestProjectPhotosAction: vi.fn(),
}));
vi.mock("@/lib/api/project-photo-blob", () => ({
  fetchProjectPhotoBlob: vi.fn(),
}));

const { loadLatestProjectPhotosAction } = await import(
  "@/app/[locale]/(app)/projects/cover-photos-actions"
);
const { fetchProjectPhotoBlob } = await import("@/lib/api/project-photo-blob");

const mockAction = vi.mocked(loadLatestProjectPhotosAction);
const mockBlob = vi.mocked(fetchProjectPhotoBlob);

const photo = (id: string) => ({
  id,
  filename: `${id}.jpg`,
  caption: null,
  capturedAt: "2026-06-02T00:00:00Z",
  thumbnailUrl: `/t/${id}`,
  originalUrl: `/o/${id}`,
});

describe("ProjectCoverPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlob.mockResolvedValue({ objectUrl: "blob:x", revoke: vi.fn() } as never);
  });

  it("renders a tile per latest photo", async () => {
    mockAction.mockResolvedValue({
      ok: true,
      photos: [photo("a"), photo("b"), photo("c")],
    } as never);

    const { container } = render(<ProjectCoverPhotos projectId="p-1" />);

    await waitFor(() => {
      expect(container.querySelectorAll("img")).toHaveLength(3);
    });
  });

  it("renders nothing when the project has no photos", async () => {
    mockAction.mockResolvedValue({ ok: true, photos: [] } as never);

    const { container } = render(<ProjectCoverPhotos projectId="p-1" />);

    // Give the effect a tick; nothing should appear.
    await waitFor(() => expect(mockAction).toHaveBeenCalled());
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
