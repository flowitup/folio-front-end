import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { updatePhotoAction, deletePhotoAction } from "../actions";
import { toast } from "sonner";
import { PhotoLightbox } from "../photo-lightbox";
import type { ProjectPhoto } from "@/lib/api/project-photos";

vi.mock("@/lib/api/project-photo-blob", () => ({
  fetchProjectPhotoBlob: vi.fn().mockResolvedValue({ objectUrl: "blob:x", contentType: "image/jpeg", revoke: vi.fn() }),
}));
vi.mock("../actions", () => ({ updatePhotoAction: vi.fn(), deletePhotoAction: vi.fn() }));
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useFormatter: () => ({
    dateTime: (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", opts),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const photo = {
  id: "22222222-2222-4222-8222-222222222222",
  caption: "Old caption",
  capturedAt: "2026-09-20T10:00:00Z",
} as unknown as ProjectPhoto;

describe("PhotoLightbox caption edit", () => {
  it("sends an empty caption (not null) so the API clears it", async () => {
    vi.mocked(updatePhotoAction).mockResolvedValue({ ok: true, data: { ...photo, caption: "" } } as never);
    render(
      <PhotoLightbox
        projectId="11111111-1111-4111-8111-111111111111"
        photo={photo}
        canEdit
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /photos\.edit/ }));
    const caption = screen.getByDisplayValue("Old caption");
    fireEvent.change(caption, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /photos\.save/ }));
    await waitFor(() => expect(updatePhotoAction).toHaveBeenCalled());
    expect(vi.mocked(updatePhotoAction).mock.calls[0][2]).toMatchObject({ caption: "" });
  });

  it("does not send the date on a caption-only edit, so the capture time is kept", async () => {
    vi.mocked(updatePhotoAction).mockReset();
    vi.mocked(updatePhotoAction).mockResolvedValue({ ok: true, data: photo } as never);
    render(
      <PhotoLightbox
        projectId="11111111-1111-4111-8111-111111111111"
        photo={photo}
        canEdit
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /photos\.edit/ }));
    fireEvent.change(screen.getByDisplayValue("Old caption"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: /photos\.save/ }));
    await waitFor(() => expect(updatePhotoAction).toHaveBeenCalled());
    expect(vi.mocked(updatePhotoAction).mock.calls[0][2].capturedAt).toBeUndefined();
  });

  it("shows and pre-fills the Paris day of a photo taken just after midnight", async () => {
    // 22:30 UTC on the 26th is 00:30 on the 27th in Paris.
    const late = { ...photo, capturedAt: "2026-09-26T22:30:00Z" } as ProjectPhoto;
    render(
      <PhotoLightbox
        projectId="11111111-1111-4111-8111-111111111111"
        photo={late}
        canEdit
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText("27 September 2026")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /photos\.edit/ }));
    expect(screen.getByDisplayValue("2026-09-27")).toBeInTheDocument();
  });

  it("reports a failed save as a save error, not an upload error", async () => {
    vi.mocked(updatePhotoAction).mockReset();
    vi.mocked(updatePhotoAction).mockResolvedValue({ ok: false, error: "server" } as never);
    render(
      <PhotoLightbox
        projectId="11111111-1111-4111-8111-111111111111"
        photo={photo}
        canEdit
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /photos\.edit/ }));
    fireEvent.click(screen.getByRole("button", { name: /photos\.save/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("photos.errors.updateFailed"));
  });

  it("confirms a delete and labels the view-mode button Close", async () => {
    vi.mocked(deletePhotoAction).mockResolvedValue({ ok: true } as never);
    const onDeleted = vi.fn();
    render(
      <PhotoLightbox
        projectId="11111111-1111-4111-8111-111111111111"
        photo={photo}
        canEdit
        onClose={vi.fn()}
        onDeleted={onDeleted}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "photos.close" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "photos.delete" }));
    const buttons = await screen.findAllByRole("button", { name: "photos.delete" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("photos.deleted");
  });
});
