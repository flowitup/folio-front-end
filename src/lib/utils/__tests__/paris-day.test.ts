import { describe, it, expect } from "vitest";
import { addDaysToDayKey, dayKeyToUtcNoon, parisDayKey } from "../paris-day";

describe("parisDayKey", () => {
  it("gives the Paris day, not the UTC day, just after midnight in Paris", () => {
    // 2026-09-26T22:30Z is 00:30 on the 27th in Paris (UTC+2).
    expect(parisDayKey(new Date("2026-09-26T22:30:00Z"))).toBe("2026-09-27");
  });

  it("follows winter time too", () => {
    // 2026-12-31T23:30Z is 00:30 on 1 January in Paris (UTC+1).
    expect(parisDayKey("2026-12-31T23:30:00Z")).toBe("2027-01-01");
  });
});

describe("addDaysToDayKey", () => {
  it("adds calendar days across month and DST boundaries", () => {
    expect(addDaysToDayKey("2026-09-27", 30)).toBe("2026-10-27");
    expect(addDaysToDayKey("2026-10-20", 30)).toBe("2026-11-19");
    expect(addDaysToDayKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayKeyToUtcNoon", () => {
  it("keeps the given day when formatted in UTC", () => {
    const d = dayKeyToUtcNoon("2026-09-27");
    expect(d.toISOString().slice(0, 10)).toBe("2026-09-27");
  });
});
