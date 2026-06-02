/**
 * Regression: the uploader must accept videos by EXTENSION even when the
 * browser reports an empty or generic MIME (e.g. messaging-app .mp4 files
 * named like 7894523245940.mp4 arrive as "" or application/octet-stream).
 * Previously a strict MIME-only check rejected these as "unsupported".
 */
import { describe, it, expect } from "vitest";
import { mediaKind } from "../photos-upload";

function fakeFile(name: string, type: string): File {
  return new File([new Uint8Array([0])], name, { type });
}

describe("mediaKind", () => {
  it("accepts images by mime + extension", () => {
    expect(mediaKind(fakeFile("a.jpg", "image/jpeg"))).toBe("image");
    expect(mediaKind(fakeFile("a.png", "image/png"))).toBe("image");
  });

  it("accepts videos with correct mime", () => {
    expect(mediaKind(fakeFile("clip.mp4", "video/mp4"))).toBe("video");
    expect(mediaKind(fakeFile("clip.webm", "video/webm"))).toBe("video");
    expect(mediaKind(fakeFile("clip.mov", "video/quicktime"))).toBe("video");
  });

  it("accepts videos when MIME is empty or generic (the reported bug)", () => {
    expect(mediaKind(fakeFile("7894523245940.mp4", ""))).toBe("video");
    expect(mediaKind(fakeFile("7894523245940.mp4", "application/octet-stream"))).toBe("video");
    expect(mediaKind(fakeFile("IMG_1.MOV", ""))).toBe("video");
  });

  it("rejects unsupported extensions", () => {
    expect(mediaKind(fakeFile("doc.pdf", "application/pdf"))).toBeNull();
    expect(mediaKind(fakeFile("movie.avi", "video/x-msvideo"))).toBeNull();
    expect(mediaKind(fakeFile("noext", ""))).toBeNull();
  });

  it("rejects a wrong-mime image even with image extension", () => {
    expect(mediaKind(fakeFile("a.jpg", "text/html"))).toBeNull();
  });
});
