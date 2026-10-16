/** Lightbox: previous / next (buttons and arrow keys), download, and a message for media the browser cannot show. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoLightbox } from "../photo-lightbox";
import type { ProjectPhoto } from "@/lib/api/project-photos";

vi.mock("@/lib/api/project-photo-blob", () => ({
  fetchProjectPhotoBlob: vi.fn().mockResolvedValue({ objectUrl: "blob:x", contentType: "video/quicktime", revoke: vi.fn() }),
}));
vi.mock("../actions", () => ({ updatePhotoAction: vi.fn(), deletePhotoAction: vi.fn() }));
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useFormatter: () => ({ dateTime: () => "20 September 2026" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const video = {
  id: "33333333-3333-4333-8333-333333333333",
  filename: "visite.mov",
  contentType: "video/quicktime",
  caption: null,
  capturedAt: "2026-09-20T10:00:00Z",
} as unknown as ProjectPhoto;

function renderLightbox(props: Partial<React.ComponentProps<typeof PhotoLightbox>> = {}) {
  return render(
    <PhotoLightbox
      projectId="11111111-1111-4111-8111-111111111111"
      photo={video}
      canEdit={false}
      onClose={vi.fn()}
      onDeleted={vi.fn()}
      onUpdated={vi.fn()}
      {...props}
    />,
  );
}

describe("PhotoLightbox browsing", () => {
  it("goes to the previous and next photo with the buttons and the arrow keys", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    renderLightbox({ onPrevious, onNext });
    fireEvent.click(await screen.findByRole("button", { name: "photos.nextPhoto" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("has no previous button on the first photo", async () => {
    renderLightbox({ onNext: vi.fn() });
    await screen.findByRole("button", { name: "photos.nextPhoto" });
    expect(screen.queryByRole("button", { name: "photos.previousPhoto" })).toBeNull();
  });

  it("explains a video the browser cannot play and offers the download", async () => {
    const { container } = renderLightbox();
    const player = await vi.waitFor(() => {
      const el = container.ownerDocument.querySelector("video");
      if (!el) throw new Error("no video yet");
      return el;
    });
    fireEvent.error(player);
    expect(screen.getByRole("alert").textContent).toContain("photos.cannotPlayVideo");

    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getAllByRole("button", { name: /photos\.download/ })[0]);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
