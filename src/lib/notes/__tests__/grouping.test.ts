/**
 * Pure-function tests for groupNotesByDay()
 * All dates use UTC to avoid DST gotchas.
 */

import { describe, it, expect } from "vitest";
import { groupNotesByDay } from "../grouping";
import type { Note } from "@/lib/api/notes";

// ---- Helpers ----

function makeNote(id: string, dueDate: string, status: "open" | "done" = "open", updatedAt?: string): Note {
  const ts = updatedAt ?? "2024-01-01T00:00:00Z";
  return {
    id,
    project_id: "proj-1",
    created_by: "user-1",
    title: `Note ${id}`,
    description: null,
    due_date: dueDate,
    lead_time_minutes: 0,
    status,
    fire_at: "2024-01-01T09:00:00Z",
    created_at: ts,
    updated_at: ts,
  };
}

/** Returns a UTC Date for YYYY-MM-DD */
function utcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const TODAY = "2024-06-15";
const todayDate = utcDate(TODAY);

const TOMORROW = "2024-06-16";
const THIS_WEEK_2 = "2024-06-17"; // today+2
const THIS_WEEK_7 = "2024-06-22"; // today+7 (boundary inclusive)
const WEEK_AFTER = "2024-06-23"; // today+8 — "later"
const PAST = "2024-06-10"; // before today — "later"

// ---- Tests ----

describe("groupNotesByDay — bucket assignment", () => {
  it("assigns due_date == today to the today bucket", () => {
    const notes = [makeNote("n1", TODAY)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.today).toHaveLength(1);
    expect(g.today[0].id).toBe("n1");
    expect(g.tomorrow).toHaveLength(0);
    expect(g.thisWeek).toHaveLength(0);
    expect(g.later).toHaveLength(0);
  });

  it("assigns due_date == tomorrow to the tomorrow bucket", () => {
    const notes = [makeNote("n2", TOMORROW)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.tomorrow).toHaveLength(1);
    expect(g.tomorrow[0].id).toBe("n2");
    expect(g.today).toHaveLength(0);
  });

  it("assigns due_date today+2 to thisWeek (lower boundary)", () => {
    const notes = [makeNote("n3", THIS_WEEK_2)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.thisWeek).toHaveLength(1);
    expect(g.thisWeek[0].id).toBe("n3");
  });

  it("assigns due_date today+7 to thisWeek (upper boundary inclusive)", () => {
    const notes = [makeNote("n4", THIS_WEEK_7)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.thisWeek).toHaveLength(1);
    expect(g.thisWeek[0].id).toBe("n4");
  });

  it("assigns due_date today+8 (one past week end) to later", () => {
    const notes = [makeNote("n5", WEEK_AFTER)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.later).toHaveLength(1);
    expect(g.later[0].id).toBe("n5");
  });

  it("assigns past due_date to later (not today / tomorrow / thisWeek)", () => {
    const notes = [makeNote("n6", PAST)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.later).toHaveLength(1);
    expect(g.later[0].id).toBe("n6");
  });

  it("places done notes in the done bucket regardless of due_date", () => {
    const notes = [makeNote("n7", TODAY, "done"), makeNote("n8", THIS_WEEK_7, "done")];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.done).toHaveLength(2);
    expect(g.today).toHaveLength(0);
    expect(g.thisWeek).toHaveLength(0);
  });

  it("handles empty input without throwing", () => {
    const g = groupNotesByDay([], todayDate);
    expect(g.today).toHaveLength(0);
    expect(g.tomorrow).toHaveLength(0);
    expect(g.thisWeek).toHaveLength(0);
    expect(g.later).toHaveLength(0);
    expect(g.done).toHaveLength(0);
  });

  it("mixed notes land in correct buckets simultaneously", () => {
    const notes = [
      makeNote("today-1", TODAY),
      makeNote("tom-1", TOMORROW),
      makeNote("week-1", THIS_WEEK_2),
      makeNote("week-2", THIS_WEEK_7),
      makeNote("later-1", WEEK_AFTER),
      makeNote("done-1", TODAY, "done"),
    ];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.today).toHaveLength(1);
    expect(g.tomorrow).toHaveLength(1);
    expect(g.thisWeek).toHaveLength(2);
    expect(g.later).toHaveLength(1);
    expect(g.done).toHaveLength(1);
  });
});

describe("groupNotesByDay — sorting within buckets", () => {
  it("sorts today bucket by due_date ascending (all same day — stable by insertion)", () => {
    // Multiple today-notes — order stable (same key)
    const notes = [makeNote("a", TODAY), makeNote("b", TODAY)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.today.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("sorts thisWeek bucket by due_date ascending", () => {
    const notes = [
      makeNote("far", THIS_WEEK_7),
      makeNote("near", THIS_WEEK_2),
    ];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.thisWeek[0].id).toBe("near");
    expect(g.thisWeek[1].id).toBe("far");
  });

  it("sorts later bucket by due_date ascending", () => {
    const far = "2025-01-01";
    const close = WEEK_AFTER;
    const notes = [makeNote("far", far), makeNote("close", close)];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.later[0].id).toBe("close");
    expect(g.later[1].id).toBe("far");
  });

  it("sorts done bucket by updated_at descending (most recent first)", () => {
    const notes = [
      makeNote("older", TODAY, "done", "2024-05-01T00:00:00Z"),
      makeNote("newer", TODAY, "done", "2024-06-01T00:00:00Z"),
    ];
    const g = groupNotesByDay(notes, todayDate);
    expect(g.done[0].id).toBe("newer");
    expect(g.done[1].id).toBe("older");
  });
});

describe("groupNotesByDay — UTC date math (no DST issues)", () => {
  it("uses UTC dates, not local dates (reference: 2024-03-10 US DST transition)", () => {
    // 2024-03-10 is US DST day — local time math could produce wrong results.
    // groupNotesByDay uses getUTCFullYear/Month/Date so it's immune.
    const dstToday = utcDate("2024-03-10");
    const tomorrowDst = "2024-03-11";
    const notes = [makeNote("dst-1", tomorrowDst)];
    const g = groupNotesByDay(notes, dstToday);
    expect(g.tomorrow).toHaveLength(1);
    expect(g.tomorrow[0].id).toBe("dst-1");
  });

  it("correctly handles year-end boundary (2024-12-31 → tomorrow = 2025-01-01)", () => {
    const yearEnd = utcDate("2024-12-31");
    const newYear = "2025-01-01";
    const notes = [makeNote("ny", newYear)];
    const g = groupNotesByDay(notes, yearEnd);
    expect(g.tomorrow).toHaveLength(1);
    expect(g.tomorrow[0].id).toBe("ny");
  });
});
