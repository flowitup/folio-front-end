/**
 * Regression: messaging-app videos (e.g. 7894523245940.mp4) reach the browser
 * with an empty MIME. They must be re-tagged to a concrete video/* type before
 * upload so the BE accepts them (no 415) and stores a video content_type.
 */
import { describe, it, expect } from "vitest";
import { inferContentType, withInferredContentType } from "../infer-content-type";

function fakeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("inferContentType", () => {
  it("keeps a concrete type", () => {
    expect(inferContentType(fakeFile("a.mp4", "video/mp4"))).toBe("video/mp4");
    expect(inferContentType(fakeFile("a.jpg", "image/jpeg"))).toBe("image/jpeg");
  });

  it("infers from extension when type is empty or generic", () => {
    expect(inferContentType(fakeFile("7894523245940.mp4", ""))).toBe("video/mp4");
    expect(inferContentType(fakeFile("clip.mov", "application/octet-stream"))).toBe("video/quicktime");
    expect(inferContentType(fakeFile("clip.webm", ""))).toBe("video/webm");
    expect(inferContentType(fakeFile("photo.png", ""))).toBe("image/png");
  });

  it("leaves unknown extensions as-is", () => {
    expect(inferContentType(fakeFile("file.xyz", ""))).toBe("");
  });
});

describe("withInferredContentType", () => {
  it("re-tags an empty-type video so the part carries video/mp4", () => {
    const out = withInferredContentType(fakeFile("7894523245940.mp4", ""));
    expect(out.type).toBe("video/mp4");
    expect(out.name).toBe("7894523245940.mp4");
  });

  it("returns the same file when type is already concrete", () => {
    const f = fakeFile("a.mp4", "video/mp4");
    expect(withInferredContentType(f)).toBe(f);
  });
});
