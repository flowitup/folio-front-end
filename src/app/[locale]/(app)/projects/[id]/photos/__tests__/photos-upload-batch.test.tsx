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

  it("reports a refused capture date as a validation error and bounds the date picker", async () => {
    vi.mocked(uploadProjectPhoto).mockRejectedValue(
      Object.assign(new Error("upload_failed:422"), {
        status: 422,
        body: { error: "INVALID_CAPTURED_AT", message: "date must not be in the future" },
      }),
    );
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={vi.fn()} />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.min).toBe("1900-01-01");
    expect(dateInput.max).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "ok.jpg", { type: "image/jpeg" })] } });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("photos.errors.validation", { description: "ok.jpg" }),
    );
  });

  it("names the 50 MB video cap, not the 25 MB image cap, for an oversized video", async () => {
    vi.mocked(uploadProjectPhoto).mockResolvedValue({ id: "v1" } as never);
    const onUploaded = vi.fn();
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={onUploaded} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const big = new File(["x"], "chantier.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 55 * 1024 * 1024 });
    const ok = new File(["x"], "visite.mp4", { type: "video/mp4" });
    Object.defineProperty(ok, "size", { value: 30 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [big, ok] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(vi.mocked(uploadProjectPhoto).mock.calls[0][1]).toBe(ok);
    expect(toast.error).toHaveBeenCalledWith("photos.errors.oversizeVideo", { description: "chantier.mp4" });
    expect(toast.error).not.toHaveBeenCalledWith("photos.errors.oversize", expect.anything());
  });

  it("maps a server-side size refusal of a video to the video cap message", async () => {
    vi.mocked(uploadProjectPhoto).mockRejectedValue(
      Object.assign(new Error("upload_failed:413"), { status: 413, body: { error: "FILE_TOO_LARGE" } }),
    );
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [
          new File(["x"], "clip.mov", { type: "video/quicktime" }),
          new File(["x"], "photo.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenCalledWith("photos.errors.oversizeVideo", { description: "clip.mov" });
    expect(toast.error).toHaveBeenCalledWith("photos.errors.oversize", { description: "photo.jpg" });
  });

  it("reports a caption the API refuses as too long as a validation error", async () => {
    vi.mocked(uploadProjectPhoto).mockRejectedValue(
      Object.assign(new Error("upload_failed:422"), {
        status: 422,
        body: { error: "INVALID_CAPTION", message: "Caption must be at most 500 characters" },
      }),
    );
    const { container } = render(<PhotosUpload projectId={PROJECT_ID} onUploaded={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "ok.jpg", { type: "image/jpeg" })] } });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("photos.errors.validation", { description: "ok.jpg" }),
    );
  });
});
