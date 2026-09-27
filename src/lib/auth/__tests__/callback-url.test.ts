import { describe, it, expect } from "vitest";
import { postLoginPath } from "../callback-url";

describe("postLoginPath", () => {
  it("returns a same-origin deep link unchanged", () => {
    expect(postLoginPath("/vi/projects/p1/planning?task=t1", "vi")).toBe(
      "/vi/projects/p1/planning?task=t1"
    );
  });

  it("keeps the query of a same-origin deep link", () => {
    expect(postLoginPath("/en/projects/p1/invoices?invoice=abc", "en")).toBe(
      "/en/projects/p1/invoices?invoice=abc"
    );
  });

  it.each([
    [null],
    [""],
    ["https://evil.example/x"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["javascript:alert(1)"],
    ["en/x"],
    ["/en/login"],
    ["/en/login?callbackUrl=/en/dashboard"],
  ])("falls back to the dashboard for %j", (raw) => {
    expect(postLoginPath(raw, "fr")).toBe("/fr/dashboard");
  });
});
