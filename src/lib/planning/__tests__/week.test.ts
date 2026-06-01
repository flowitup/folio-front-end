import { describe, it, expect } from "vitest";
import {
  addWeeks,
  formatWeekRange,
  startOfWeekMonday,
  toDateKey,
  weekDays,
  weekOffsetFromParam,
} from "@/lib/planning/week";

describe("planning week math", () => {
  it("toDateKey formats local Y-M-D zero-padded", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("toDateKey has no UTC off-by-one near midnight", () => {
    // 00:30 local on the 7th stays the 7th regardless of host TZ.
    expect(toDateKey(new Date(2026, 5, 7, 0, 30))).toBe("2026-06-07");
    // 23:30 local on the 1st stays the 1st.
    expect(toDateKey(new Date(2026, 5, 1, 23, 30))).toBe("2026-06-01");
  });

  it("startOfWeekMonday returns the Monday on/before the date", () => {
    // 2026-06-07 is a Sunday → its week's Monday is 2026-06-01.
    expect(toDateKey(startOfWeekMonday(new Date(2026, 5, 7)))).toBe("2026-06-01");
    // A Monday maps to itself.
    expect(toDateKey(startOfWeekMonday(new Date(2026, 5, 1)))).toBe("2026-06-01");
    // A Wednesday maps back to Monday.
    expect(toDateKey(startOfWeekMonday(new Date(2026, 5, 3)))).toBe("2026-06-01");
  });

  it("addWeeks shifts by whole-week multiples", () => {
    const mon = startOfWeekMonday(new Date(2026, 5, 1));
    expect(toDateKey(addWeeks(mon, 1))).toBe("2026-06-08");
    expect(toDateKey(addWeeks(mon, -1))).toBe("2026-05-25");
    expect(toDateKey(addWeeks(mon, 0))).toBe("2026-06-01");
  });

  it("weekDays returns 7 ordered Mon→Sun dates", () => {
    const days = weekDays(new Date(2026, 5, 1));
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0])).toBe("2026-06-01"); // Mon
    expect(toDateKey(days[6])).toBe("2026-06-07"); // Sun
  });

  it("formatWeekRange renders a readable range (exact format)", () => {
    // Same-month week: month shown once, no stray tokens.
    expect(formatWeekRange(new Date(2026, 5, 1), "en-US")).toBe("Jun 1 – 7, 2026");
    // Cross-month week (May 28 → Jun 3): both months shown, year once.
    expect(formatWeekRange(new Date(2026, 4, 28), "en-US")).toBe("May 28 – Jun 3, 2026");
    // Guard against the partial-Intl garbling ("2026 (day: 7)").
    expect(formatWeekRange(new Date(2026, 5, 1), "en-US")).not.toMatch(/day:/);
  });

  it("weekOffsetFromParam parses safely", () => {
    expect(weekOffsetFromParam(null)).toBe(0);
    expect(weekOffsetFromParam("")).toBe(0);
    expect(weekOffsetFromParam("3")).toBe(3);
    expect(weekOffsetFromParam("-2")).toBe(-2);
    expect(weekOffsetFromParam("abc")).toBe(0);
  });
});
