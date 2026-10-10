/**
 * Pure-function tests for createdBucket() and buildSections()
 * Dates are built on the local calendar, as the buckets are.
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

/** Local noon of YYYY-MM-DD: buckets follow the viewer's calendar, not UTC. */
function localDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** ISO timestamp (as the API sends it) of a LOCAL date and hour. */
function localIso(dateStr: string, hour = 10, minute = 0): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

const TODAY_STR = "2024-06-15"; // a Saturday; its week starts Monday 2024-06-10
const todayDate = localDate(TODAY_STR);

// ISO timestamps for each bucket
const NOW_ISO       = localIso("2024-06-15"); // today
const YESTERDAY_ISO = localIso("2024-06-14"); // yesterday
const WEEK_ISO      = localIso("2024-06-12"); // earlier this week (Wednesday)
const WEEK_EDGE_ISO = localIso("2024-06-10", 0, 5); // this week's Monday, just after midnight
const EARLIER_ISO   = localIso("2024-06-09", 23, 55); // last Sunday, "earlier"
const OLD_ISO       = localIso("2024-01-01"); // much older

// ---- createdBucket ----

describe("createdBucket — bucket assignment", () => {
  it("today → today", () => {
    expect(createdBucket(NOW_ISO, todayDate)).toBe("today");
  });

  it("yesterday → yesterday", () => {
    expect(createdBucket(YESTERDAY_ISO, todayDate)).toBe("yesterday");
  });

  it("earlier this week (Wednesday) → week", () => {
    expect(createdBucket(WEEK_ISO, todayDate)).toBe("week");
  });

  it("this week's Monday (lower boundary) → week", () => {
    expect(createdBucket(WEEK_EDGE_ISO, todayDate)).toBe("week");
  });

  it("last week's Sunday → earlier, though within the last 7 days", () => {
    expect(createdBucket(EARLIER_ISO, todayDate)).toBe("earlier");
  });

  it("on a Wednesday, last Friday is not 'earlier this week'", () => {
    const wednesday = localDate("2026-10-14");
    expect(createdBucket(localIso("2026-10-09", 20, 58), wednesday)).toBe("earlier");
    expect(createdBucket(localIso("2026-10-12", 9), wednesday)).toBe("week");
  });

  it("on a Monday, nothing is 'earlier this week'", () => {
    const monday = localDate("2026-10-12");
    expect(createdBucket(localIso("2026-10-11"), monday)).toBe("yesterday");
    expect(createdBucket(localIso("2026-10-10"), monday)).toBe("earlier");
  });

  it("very old note → earlier", () => {
    expect(createdBucket(OLD_ISO, todayDate)).toBe("earlier");
  });

  it("uses the local day, not the UTC one, just after local midnight", () => {
    // 00:30 local on the 10th is still the 9th in UTC east of Greenwich
    // (and 10:00 the 9th is the 9th everywhere): today vs yesterday.
    const justAfterMidnight = new Date(2026, 9, 10, 0, 30);
    expect(createdBucket(localIso("2026-10-09", 20, 58), justAfterMidnight)).toBe("yesterday");
    expect(createdBucket(localIso("2026-10-10", 0, 10), justAfterMidnight)).toBe("today");
  });

  it("handles a DST change (2024-03-31 in Europe)", () => {
    expect(createdBucket(localIso("2024-03-30", 12), localDate("2024-03-31"))).toBe("yesterday");
  });

  it("handles year-end boundary (2024-12-31 → yesterday = 2024-12-30)", () => {
    expect(createdBucket(localIso("2024-12-30", 12), localDate("2024-12-31"))).toBe("yesterday");
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
    const earlier = makeNote("e", localIso("2024-06-11", 8));
    const later   = makeNote("l", localIso("2024-06-11", 18));
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
