import { describe, it, expect } from "vitest";
import { formatBonusDays, formatDays } from "../format-days";

describe("formatDays", () => {
  it("uses the app language's decimal separator", () => {
    expect(formatDays(2.5, "fr")).toBe("2,5");
    expect(formatDays(2.5, "en")).toBe("2.5");
    expect(formatDays(5, "fr")).toBe("5");
    expect(formatDays(5.25, "fr")).toBe("5,25");
    expect(formatBonusDays(1.5, "fr")).toBe("1,5");
    expect(formatBonusDays(2, "fr")).toBe("2");
  });
});
