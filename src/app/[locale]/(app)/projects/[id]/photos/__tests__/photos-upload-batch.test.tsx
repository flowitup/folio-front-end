import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { uploadProjectPhoto } from "@/lib/api/project-photo-blob";
import { PhotosUpload } from "../photos-upload";

vi.mock("@/lib/api/project-photo-blob", () => ({ uploadProjectPhoto: vi.fn() }));
vi.mock("next-intl", () => ({ useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("PhotosUpload batch validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads the valid files and reports each rejected one", async () => {
    vi.mocked(uploadProjectPhoto).mockResolvedValue({ id: "p1" } as never);
    const onUploaded = vi.fn();
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={onUploaded} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const pdf = new File(["x"], "qa-doc.pdf", { type: "application/pdf" });
    const jpg = new File(["x"], "ok.jpg", { type: "image/jpeg" });
    const huge = new File(["x"], "huge.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [pdf, jpg, huge] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(uploadProjectPhoto).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadProjectPhoto).mock.calls[0][1]).toBe(jpg);
    expect(toast.error).toHaveBeenCalledWith("photos.errors.unsupported", { description: "qa-doc.pdf" });
    expect(toast.error).toHaveBeenCalledWith("photos.errors.oversize", { description: "huge.jpg" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("uploads nothing when every file is rejected", async () => {
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(uploadProjectPhoto).not.toHaveBeenCalled();
  });
});
