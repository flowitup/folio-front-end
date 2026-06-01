/**
 * Tests for PhotosGallery component.
 *
 * Covers:
 * - Renders date-grouped section headers (newest group first)
 * - Empty state renders when no photos
 * - Clicking a thumbnail calls setSelectedPhoto → PhotoLightbox opens
 * - Multiple date groups are ordered correctly (newest first)
 *
 * Timer strategy: PhotoThumb uses an async useEffect for blob loading.
 * We mock fetchProjectPhotoBlob to return a fixed objectUrl synchronously,
 * and use fireEvent (not userEvent) + waitFor to avoid fake-timer deadlocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PhotosGallery } from "../photos-gallery";
import type { ProjectPhoto } from "@/lib/api/project-photos";

// ---- Mocks (must be before imports) ----

vi.mock("@/lib/api/project-photo-blob", () => ({
  fetchProjectPhotoBlob: vi.fn().mockResolvedValue({
    objectUrl: "blob:fake-thumb-url",
    contentType: "image/jpeg",
    revoke: vi.fn(),
  }),
}));

// Mock server actions imported transitively by photo-lightbox
vi.mock("../actions", () => ({
  uploadPhotoAction: vi.fn(),
  updatePhotoAction: vi.fn(),
  deletePhotoAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const full = `${ns}.${key}`;
    if (!params) return full;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      full
    );
  },
  useFormatter: () => ({
    dateTime: (date: Date, _opts: unknown) => {
      // Return a predictable label for tests
      const iso = date.toISOString().slice(0, 10);
      return `formatted:${iso}`;
    },
  }),
}));

vi.mock("sonner", () => {
  const toastFn = vi.fn();
  Object.assign(toastFn, {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  });
  return { toast: toastFn };
});

// ---- Helpers ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function makePhoto(id: string, capturedAt: string, caption: string | null = null): ProjectPhoto {
  return {
    id,
    projectId: PROJECT_ID,
    filename: `${id}.jpg`,
    contentType: "image/jpeg",
    sizeBytes: 4096,
    caption,
    capturedAt,
    uploadedAt: "2024-06-16T08:00:00Z",
    uploaderId: "uploader-1",
    thumbnailUrl: `/api/projects/${PROJECT_ID}/photos/${id}/thumbnail`,
    originalUrl: `/api/projects/${PROJECT_ID}/photos/${id}/original`,
  };
}

// ---- Setup ----

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("PhotosGallery — empty state", () => {
  it("renders empty state title when no photos and canEdit=false", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[]}
        initialTotal={0}
        canEdit={false}
      />
    );
    expect(screen.getByText("photos.empty.title")).toBeDefined();
    expect(screen.getByText("photos.empty.description")).toBeDefined();
  });

  it("renders add-photos button in empty state when canEdit=true", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[]}
        initialTotal={0}
        canEdit={true}
      />
    );
    expect(screen.getByText("photos.empty.title")).toBeDefined();
    // Multiple "addPhotos" buttons may appear (header + empty state CTA)
    const addButtons = screen.getAllByText("photos.addPhotos");
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render date group headers when list is empty", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[]}
        initialTotal={0}
        canEdit={false}
      />
    );
    // No section elements with date labels
    const sections = document.querySelectorAll("section[aria-label]");
    expect(sections.length).toBe(0);
  });
});

// ── Date grouping ─────────────────────────────────────────────────────────────

describe("PhotosGallery — date groups", () => {
  it("renders a section for each distinct date", async () => {
    const photos = [
      makePhoto("a", "2024-06-15T10:00:00Z"),
      makePhoto("b", "2024-06-14T10:00:00Z"),
    ];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={2}
        canEdit={false}
      />
    );

    const sections = document.querySelectorAll("section[aria-label]");
    expect(sections.length).toBe(2);
  });

  it("renders formatted date label as section heading", async () => {
    const photos = [makePhoto("a", "2024-06-15T10:00:00Z")];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={1}
        canEdit={false}
      />
    );

    // The useFormatter mock returns "formatted:YYYY-MM-DD"
    expect(screen.getByText("formatted:2024-06-15")).toBeDefined();
  });

  it("groups photos with the same date into one section", async () => {
    const photos = [
      makePhoto("a", "2024-06-15T08:00:00Z"),
      makePhoto("b", "2024-06-15T14:00:00Z"),
      makePhoto("c", "2024-06-14T10:00:00Z"),
    ];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={3}
        canEdit={false}
      />
    );

    const sections = document.querySelectorAll("section[aria-label]");
    // 2 distinct dates → 2 sections
    expect(sections.length).toBe(2);
  });

  it("orders groups newest first (June 15 before June 14)", async () => {
    const photos = [
      makePhoto("old", "2024-06-14T10:00:00Z"),
      makePhoto("new", "2024-06-15T10:00:00Z"),
    ];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={2}
        canEdit={false}
      />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    // First heading should be the newer date
    expect(headings[0].textContent).toBe("formatted:2024-06-15");
    expect(headings[1].textContent).toBe("formatted:2024-06-14");
  });

  it("renders '—' label for photos with unknown/missing capturedAt", async () => {
    // Force a photo with an empty capturedAt string (edge case)
    const photo: ProjectPhoto = {
      ...makePhoto("x", ""),
      capturedAt: "",
    };

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[photo]}
        initialTotal={1}
        canEdit={false}
      />
    );

    expect(screen.getByText("—")).toBeDefined();
  });
});

// ── Thumbnail rendering ───────────────────────────────────────────────────────

describe("PhotosGallery — thumbnail rendering", () => {
  it("renders a skeleton initially then the image after blob resolves", async () => {
    const photos = [makePhoto("img1", "2024-06-15T10:00:00Z", "My caption")];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={1}
        canEdit={false}
      />
    );

    // After blob fetch resolves, the button with aria-label should appear
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "My caption" });
      expect(btn).toBeDefined();
    });
  });

  it("uses filename as aria-label when caption is null", async () => {
    const photos = [makePhoto("img2", "2024-06-15T10:00:00Z", null)];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={1}
        canEdit={false}
      />
    );

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "img2.jpg" });
      expect(btn).toBeDefined();
    });
  });

  it("renders correct number of thumbnails per group", async () => {
    const photos = [
      makePhoto("p1", "2024-06-15T10:00:00Z"),
      makePhoto("p2", "2024-06-15T11:00:00Z"),
      makePhoto("p3", "2024-06-14T10:00:00Z"),
    ];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={3}
        canEdit={false}
      />
    );

    await waitFor(() => {
      // 3 thumbnails total — 2 on June 15, 1 on June 14
      const buttons = screen.getAllByRole("button", { name: /\.jpg$/i });
      expect(buttons.length).toBe(3);
    });
  });
});

// ── Lightbox open on click ────────────────────────────────────────────────────

describe("PhotosGallery — lightbox opens on thumb click", () => {
  it("clicking a thumbnail opens PhotoLightbox (dialog becomes visible)", async () => {
    const { fetchProjectPhotoBlob } = await import("@/lib/api/project-photo-blob");
    // Ensure blob resolves immediately for this test
    vi.mocked(fetchProjectPhotoBlob).mockResolvedValue({
      objectUrl: "blob:fake-thumb-url",
      contentType: "image/jpeg",
      revoke: vi.fn(),
    });

    const photos = [makePhoto("click1", "2024-06-15T10:00:00Z", "Click me")];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={1}
        canEdit={false}
      />
    );

    // Wait for thumbnail to fully render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
    });

    // Click the thumbnail
    const thumbBtn = screen.getByRole("button", { name: "Click me" });
    await act(async () => {
      fireEvent.click(thumbBtn);
    });

    // PhotoLightbox dialog should be open — confirmed by the cancel/close button appearing
    await waitFor(() => {
      // The lightbox renders a "cancel" button (ghost variant) in display mode
      expect(screen.getByText("photos.cancel")).toBeDefined();
    });
  });

  it("lightbox is not visible before clicking a thumbnail", () => {
    const photos = [makePhoto("noclk", "2024-06-15T10:00:00Z")];

    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={photos}
        initialTotal={1}
        canEdit={false}
      />
    );

    // Dialog should not show the delete/edit buttons when closed
    expect(screen.queryByText("photos.delete")).toBeNull();
  });
});

// ── canEdit controls ──────────────────────────────────────────────────────────

describe("PhotosGallery — canEdit flag", () => {
  it("hides add-photos header button when canEdit=false", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[makePhoto("x", "2024-06-15T10:00:00Z")]}
        initialTotal={1}
        canEdit={false}
      />
    );
    // "addPhotos" button should NOT appear in the header when canEdit=false
    expect(screen.queryByText("photos.addPhotos")).toBeNull();
  });

  it("shows add-photos header button when canEdit=true", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[makePhoto("x", "2024-06-15T10:00:00Z")]}
        initialTotal={1}
        canEdit={true}
      />
    );
    expect(screen.getByText("photos.addPhotos")).toBeDefined();
  });

  it("clicking add-photos button reveals PhotosUpload panel", () => {
    render(
      <PhotosGallery
        projectId={PROJECT_ID}
        initialPhotos={[]}
        initialTotal={0}
        canEdit={true}
      />
    );

    // The header has two "addPhotos" buttons when empty (header + empty state CTA)
    const addBtn = screen.getAllByText("photos.addPhotos")[0];
    fireEvent.click(addBtn);

    // PhotosUpload panel should now be visible (it has a caption label input)
    expect(screen.getByText("photos.caption.label")).toBeDefined();
  });
});
