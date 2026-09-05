import { describe, it, expect } from "vitest";
import {
  formatJoinCode,
  looksLikeJoinCode,
  normalizeJoinCode,
} from "@/lib/companies/join-code";

describe("join-code helpers", () => {
  it("normalizes case, dashes and whitespace", () => {
    expect(normalizeJoinCode(" uynv-lygl ")).toBe("UYNVLYGL");
    expect(normalizeJoinCode("UYNV LYGL")).toBe("UYNVLYGL");
  });

  it("formats an 8-character code as XXXX-XXXX and leaves other lengths alone", () => {
    expect(formatJoinCode("UYNVLYGL")).toBe("UYNV-LYGL");
    expect(formatJoinCode("uynv-lygl")).toBe("UYNV-LYGL");
    expect(formatJoinCode("ABC")).toBe("ABC");
  });

  it("tells a company code from an invite token", () => {
    expect(looksLikeJoinCode("UYNV-LYGL")).toBe(true);
    expect(looksLikeJoinCode("uynvlygl")).toBe(true);
    expect(looksLikeJoinCode("AAAA")).toBe(false);
    expect(looksLikeJoinCode("f3a9c1e2b7d4e6f8a0b1c2d3e4f5a6b7")).toBe(false);
    expect(looksLikeJoinCode("UYNV-LYG!")).toBe(false);
  });
});
