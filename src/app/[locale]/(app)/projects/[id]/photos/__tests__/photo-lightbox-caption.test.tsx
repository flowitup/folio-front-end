import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { updatePhotoAction } from "../actions";
import { PhotoLightbox } from "../photo-lightbox";
import type { ProjectPhoto } from "@/lib/api/project-photos";

vi.mock("@/lib/api/project-photo-blob", () => ({
  fetchProjectPhotoBlob: vi.fn().mockResolvedValue({ objectUrl: "blob:x", contentType: "image/jpeg", revoke: vi.fn() }),
}));
vi.mock("../actions", () => ({ updatePhotoAction: vi.fn(), deletePhotoAction: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }));
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
});
