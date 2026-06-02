import { describe, it, expect } from "vitest";
import { isVideo } from "@/lib/media/is-video";

describe("isVideo", () => {
  it("is true for video MIME types", () => {
    expect(isVideo("video/mp4")).toBe(true);
    expect(isVideo("video/webm")).toBe(true);
    expect(isVideo("video/quicktime")).toBe(true);
  });

  it("is false for images and empty values", () => {
    expect(isVideo("image/jpeg")).toBe(false);
    expect(isVideo("image/png")).toBe(false);
    expect(isVideo("")).toBe(false);
    expect(isVideo(null)).toBe(false);
    expect(isVideo(undefined)).toBe(false);
  });
});
