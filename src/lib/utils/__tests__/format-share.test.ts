import { describe, it, expect } from "vitest";
import { formatShare } from "../format-percent";

const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatShare", () => {
  it("keeps one decimal below 1 % so a real share never reads 0 %", () => {
    expect(plain(formatShare("fr", 0.37))).toBe("0,4 %");
    expect(formatShare("en", 0.37)).toBe("0.4%");
  });

  it("rounds to whole percents from 1 % and says 0 for nothing", () => {
    expect(plain(formatShare("fr", 2.8))).toBe("3 %");
    expect(formatShare("vi", 120.4)).toBe("120%");
    expect(plain(formatShare("fr", 0))).toBe("0 %");
  });
});
