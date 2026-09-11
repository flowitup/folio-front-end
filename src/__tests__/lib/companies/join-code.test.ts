import { describe, it, expect } from "vitest";
import { formatJoinCode, normalizeJoinCode } from "@/lib/companies/join-code";

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
});
