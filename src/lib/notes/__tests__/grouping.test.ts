/**
 * Pure-function tests for createdBucket() and buildSections()
 * All dates use UTC to avoid DST gotchas.
 */

import { describe, it, expect } from "vitest";
import { createdBucket, buildSections } from "../grouping";
import type { Note } from "@/lib/api/notes";

// ---- Helpers ----

function makeNote(
  id: string,
  createdAt: string,
  category: Note["category"] = "general"
): Note {
  return {
    id,
    project_id: "proj-1",
    created_by: "user-1",
    title: `Note ${id}`,
    description: null,
    category,
    status: "open" as const,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

/** Returns a UTC Date for YYYY-MM-DD at noon */
function utcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

const TODAY_STR = "2024-06-15";
const todayDate = utcDate(TODAY_STR);

// ISO timestamps for each bucket
const NOW_ISO       = "2024-06-15T10:00:00Z"; // today
const YESTERDAY_ISO = "2024-06-14T10:00:00Z"; // yesterday
const WEEK_ISO      = "2024-06-10T10:00:00Z"; // within last 7 days (today-5)
const WEEK_EDGE_ISO = "2024-06-08T10:00:00Z"; // today-7, still "week"
const EARLIER_ISO   = "2024-06-07T10:00:00Z"; // today-8, "earlier"
const OLD_ISO       = "2024-01-01T10:00:00Z"; // much older

// ---- createdBucket ----

describe("createdBucket — bucket assignment", () => {
  it("today → today", () => {
    expect(createdBucket(NOW_ISO, todayDate)).toBe("today");
  });

  it("yesterday → yesterday", () => {
    expect(createdBucket(YESTERDAY_ISO, todayDate)).toBe("yesterday");
  });

  it("within last 7 days (today-5) → week", () => {
    expect(createdBucket(WEEK_ISO, todayDate)).toBe("week");
  });

  it("today-7 (lower boundary) → week", () => {
    expect(createdBucket(WEEK_EDGE_ISO, todayDate)).toBe("week");
  });

  it("today-8 → earlier", () => {
    expect(createdBucket(EARLIER_ISO, todayDate)).toBe("earlier");
  });

  it("very old note → earlier", () => {
    expect(createdBucket(OLD_ISO, todayDate)).toBe("earlier");
  });

  it("uses UTC dates — immune to DST (2024-03-10 US DST boundary)", () => {
    const dstToday = utcDate("2024-03-10");
    const yesterdayDst = "2024-03-09T12:00:00Z";
    expect(createdBucket(yesterdayDst, dstToday)).toBe("yesterday");
  });

  it("handles year-end boundary (2024-12-31 → yesterday = 2024-12-30)", () => {
    const yearEnd = utcDate("2024-12-31");
    const dec30 = "2024-12-30T12:00:00Z";
    expect(createdBucket(dec30, yearEnd)).toBe("yesterday");
  });
});

// ---- buildSections (date grouping) ----

describe("buildSections — date grouping", () => {
  it("returns empty array for empty input", () => {
    expect(buildSections([], "date", todayDate)).toEqual([]);
  });

  it("puts today note in today section", () => {
    const notes = [makeNote("n1", NOW_ISO)];
    const sections = buildSections(notes, "date", todayDate);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("today");
    expect(sections[0].items[0].id).toBe("n1");
  });

  it("omits empty sections", () => {
    const notes = [makeNote("n1", NOW_ISO), makeNote("n2", OLD_ISO)];
    const sections = buildSections(notes, "date", todayDate);
    const keys = sections.map((s) => s.key);
    expect(keys).toContain("today");
    expect(keys).toContain("earlier");
    expect(keys).not.toContain("yesterday");
    expect(keys).not.toContain("week");
  });

  it("sections appear in order: today → yesterday → week → earlier", () => {
    const notes = [
      makeNote("old", OLD_ISO),
      makeNote("yest", YESTERDAY_ISO),
      makeNote("tod", NOW_ISO),
      makeNote("wk", WEEK_ISO),
    ];
    const sections = buildSections(notes, "date", todayDate);
    const keys = sections.map((s) => s.key);
    expect(keys).toEqual(["today", "yesterday", "week", "earlier"]);
  });

  it("items within a section are sorted created_at DESC", () => {
    const earlier = makeNote("e", "2024-06-08T08:00:00Z");
    const later   = makeNote("l", "2024-06-08T18:00:00Z");
    const sections = buildSections([earlier, later], "date", todayDate);
    expect(sections[0].key).toBe("week");
    expect(sections[0].items[0].id).toBe("l");
    expect(sections[0].items[1].id).toBe("e");
  });

  it("date sections have no dotColor", () => {
    const notes = [makeNote("n1", NOW_ISO)];
    const sections = buildSections(notes, "date", todayDate);
    expect(sections[0].dotColor).toBeUndefined();
  });

  it("labelKey follows notes.groups.* pattern", () => {
    const notes = [makeNote("n1", NOW_ISO)];
    const sections = buildSections(notes, "date", todayDate);
    expect(sections[0].labelKey).toBe("notes.groups.today");
  });
});

// ---- buildSections (category grouping) ----

describe("buildSections — category grouping", () => {
  it("returns empty array when no notes", () => {
    expect(buildSections([], "category", todayDate)).toEqual([]);
  });

  it("groups by category; dotColor present", () => {
    const notes = [
      makeNote("a", NOW_ISO, "delivery"),
      makeNote("b", NOW_ISO, "payment"),
    ];
    const sections = buildSections(notes, "category", todayDate);
    expect(sections).toHaveLength(2);
    const keys = sections.map((s) => s.key);
    expect(keys).toContain("delivery");
    expect(keys).toContain("payment");
    sections.forEach((s) => expect(s.dotColor).toBeTruthy());
  });

  it("category sections follow CATEGORY_ORDER (delivery before payment)", () => {
    const notes = [makeNote("a", NOW_ISO, "payment"), makeNote("b", NOW_ISO, "delivery")];
    const sections = buildSections(notes, "category", todayDate);
    expect(sections[0].key).toBe("delivery");
    expect(sections[1].key).toBe("payment");
  });

  it("omits categories with no notes", () => {
    const notes = [makeNote("n1", NOW_ISO, "call")];
    const sections = buildSections(notes, "category", todayDate);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("call");
  });

  it("items within each category sorted created_at DESC", () => {
    const older = makeNote("old", "2024-06-10T08:00:00Z", "general");
    const newer = makeNote("new", "2024-06-10T18:00:00Z", "general");
    const sections = buildSections([older, newer], "category", todayDate);
    expect(sections[0].items[0].id).toBe("new");
    expect(sections[0].items[1].id).toBe("old");
  });

  it("labelKey matches the category i18n key", () => {
    const notes = [makeNote("n1", NOW_ISO, "inspection")];
    const sections = buildSections(notes, "category", todayDate);
    expect(sections[0].labelKey).toBe("notes.categories.inspection");
  });
});
