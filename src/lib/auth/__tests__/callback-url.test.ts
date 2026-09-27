import { describe, it, expect } from "vitest";
import { safeCallbackPath } from "../callback-url";

describe("safeCallbackPath", () => {
  it("accepts a same-origin path with its query", () => {
    expect(safeCallbackPath("/en/projects/p1/invoices?invoice=abc")).toBe(
      "/en/projects/p1/invoices?invoice=abc"
    );
  });

  it.each([null, "", "https://evil.test/", "//evil.test/x", "/\\evil.test", "javascript:alert(1)", "en/x"])(
    "refuses %j",
    (value) => {
      expect(safeCallbackPath(value)).toBeNull();
    }
  );
});
