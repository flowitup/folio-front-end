/**
 * Worker change-request helpers: shaping entries / bell feed items into one
 * review model, merging both sources, and the "current vs requested" lines.
 */

import { describe, it, expect } from "vitest";

import {
  changeRequestFromEntry,
  changeRequestFromFeedItem,
  describeChangeRequest,
  formatShiftSummary,
  mergeChangeRequests,
} from "../change-requests";
import type { AttendancePending } from "@/lib/api/notifications";
import type { AttendanceChangeRequest, LaborEntry } from "@/types/labor";

const t = (key: string) => `[${key}]`;

function entry(overrides: Partial<LaborEntry> = {}): LaborEntry {
  return {
    id: "e1",
    worker_id: "w1",
    worker_name: "Nguyen Van Tho",
    date: "2026-09-06",
    amount_override: null,
    effective_cost: 120,
    note: "arrived 7am",
    shift_type: "full",
    supplement_hours: 2,
    created_at: "2026-09-06T06:00:00",
    status: "validated",
    change_requested_at: "2026-09-08T18:00:00",
    proposed_shift_type: "half",
    proposed_supplement_hours: 0,
    proposed_note: "left at noon",
    ...overrides,
  };
}

function request(overrides: Partial<AttendanceChangeRequest> = {}): AttendanceChangeRequest {
  return { ...changeRequestFromEntry(entry()), ...overrides };
}

describe("changeRequestFromEntry / changeRequestFromFeedItem", () => {
  it("keeps the current values next to the proposed ones", () => {
    expect(changeRequestFromEntry(entry())).toEqual({
      entry_id: "e1",
      worker_id: "w1",
      worker_name: "Nguyen Van Tho",
      date: "2026-09-06",
      shift_type: "full",
      supplement_hours: 2,
      note: "arrived 7am",
      proposed_shift_type: "half",
      proposed_supplement_hours: 0,
      proposed_note: "left at noon",
      requested_at: "2026-09-08T18:00:00",
    });
  });

  it("uses the feed item's submitted_at as the request time and defaults missing proposals", () => {
    const item: AttendancePending = {
      kind: "attendance_change",
      entry_id: "e2",
      project_id: "p1",
      project_name: "Chantier",
      worker_id: "w2",
      worker_name: "Tran",
      date: "2026-09-05",
      shift_type: "full",
      supplement_hours: 0,
      note: null,
      submitted_at: "2026-09-07T09:00:00",
      proposed_shift_type: null,
      proposed_supplement_hours: null,
    };
    expect(changeRequestFromFeedItem(item)).toMatchObject({
      entry_id: "e2",
      requested_at: "2026-09-07T09:00:00",
      proposed_shift_type: null,
      proposed_supplement_hours: 0,
      proposed_note: null,
    });
  });
});

describe("mergeChangeRequests", () => {
  it("keeps one request per entry (first source wins) and sorts newest day first, then by worker", () => {
    const merged = mergeChangeRequests(
      [request({ entry_id: "a", date: "2026-09-01", worker_name: "Zoe" })],
      [
        request({ entry_id: "a", date: "2026-09-01", worker_name: "stale copy" }),
        request({ entry_id: "b", date: "2026-09-03", worker_name: "Binh" }),
        request({ entry_id: "c", date: "2026-09-01", worker_name: "An" }),
      ],
    );
    expect(merged.map((r) => [r.entry_id, r.worker_name])).toEqual([
      ["b", "Binh"],
      ["c", "An"],
      ["a", "Zoe"],
    ]);
  });

  it("returns an empty list when there is nothing to merge", () => {
    expect(mergeChangeRequests([], [])).toEqual([]);
  });
});

describe("formatShiftSummary", () => {
  it("labels the shift and appends supplement hours", () => {
    expect(formatShiftSummary(t, "full", 2)).toBe("[shiftFull] · +2h");
    expect(formatShiftSummary(t, "half", 0)).toBe("[shiftHalf]");
    expect(formatShiftSummary(t, "overtime", null)).toBe("[shiftOvertime]");
  });

  it("marks supplement-only days and falls back to a dash for an empty day", () => {
    expect(formatShiftSummary(t, null, 3)).toBe("+3h [supplement.standaloneShiftLabel]");
    expect(formatShiftSummary(t, null, 0)).toBe("—");
  });
});

describe("describeChangeRequest", () => {
  it("shows both notes when the worker replaces it", () => {
    expect(describeChangeRequest(t, request())).toEqual({
      current: "[shiftFull] · +2h — arrived 7am",
      proposed: "[shiftHalf] — left at noon",
    });
  });

  it("says the current note goes away when the proposal has none", () => {
    expect(describeChangeRequest(t, request({ proposed_note: null })).proposed).toBe(
      "[shiftHalf] — [changeRequest.noteCleared]",
    );
  });

  it("adds no note text when neither side has one", () => {
    expect(describeChangeRequest(t, request({ note: null, proposed_note: null }))).toEqual({
      current: "[shiftFull] · +2h",
      proposed: "[shiftHalf]",
    });
  });
});
