import { describe, it, expect } from "vitest";
import { formatBytes } from "../format-bytes";

describe("formatBytes", () => {
  it("uses the app language's decimal separator and units", () => {
    expect(formatBytes(3686, "en")).toBe("3.6 KB");
    expect(formatBytes(3686, "fr")).toBe("3,6 Ko");
    expect(formatBytes(3686, "vi")).toBe("3,6 KB");
    expect(formatBytes(512, "fr")).toBe("512 o");
    expect(formatBytes(5 * 1024 * 1024, "fr")).toBe("5,0 Mo");
  });
});
