/**
 * fetchAttendanceChangeRequestsAction — the project's open worker change
 * requests, taken from the caller's notifications feed (the backend has no
 * per-project listing): only `attendance_change` items of this project.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AttendancePending } from "@/lib/api/notifications";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/api/notifications", () => ({
  listDueNotifications: vi.fn(),
}));

// The other actions in the module pull these in; they are not exercised here.
vi.mock("@/lib/api/labor-roles", () => ({ fetchLaborRoles: vi.fn(), createLaborRole: vi.fn() }));
vi.mock("@/lib/api/roster", () => ({ fetchDayRoster: vi.fn() }));

const { fetchAttendanceChangeRequestsAction } = await import("../actions");
const { listDueNotifications } = await import("@/lib/api/notifications");
const mockList = vi.mocked(listDueNotifications);

function item(overrides: Partial<AttendancePending>): AttendancePending {
  return {
    kind: "attendance_change",
    entry_id: "e1",
    project_id: "proj-1",
    project_name: "Chantier",
    worker_id: "w1",
    worker_name: "Tho",
    date: "2026-09-06",
    shift_type: "full",
    supplement_hours: 0,
    note: null,
    submitted_at: "2026-09-08T18:00:00",
    proposed_shift_type: "half",
    proposed_supplement_hours: 0,
    proposed_note: "left at noon",
    ...overrides,
  };
}

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchAttendanceChangeRequestsAction", () => {
  it("keeps only this project's change requests, shaped for review", async () => {
    mockList.mockResolvedValue({
      items: [],
      count: 3,
      attendance_pending: [
        item({ entry_id: "e1" }),
        item({ entry_id: "e2", kind: "attendance_pending" }),
        item({ entry_id: "e3", project_id: "proj-2" }),
      ],
    });

    const result = await fetchAttendanceChangeRequestsAction("proj-1");

    expect(result).toEqual({
      success: true,
      data: [
        {
          entry_id: "e1",
          worker_id: "w1",
          worker_name: "Tho",
          date: "2026-09-06",
          shift_type: "full",
          supplement_hours: 0,
          note: null,
          proposed_shift_type: "half",
          proposed_supplement_hours: 0,
          proposed_note: "left at noon",
          requested_at: "2026-09-08T18:00:00",
        },
      ],
    });
  });

  it("treats a feed without the attendance list (older backend) as empty", async () => {
    mockList.mockResolvedValue({ items: [], count: 0 });
    expect(await fetchAttendanceChangeRequestsAction("proj-1")).toEqual({ success: true, data: [] });
  });

  it("maps backend failures to an error code", async () => {
    mockList.mockRejectedValue(httpError(403));
    expect(await fetchAttendanceChangeRequestsAction("proj-1")).toEqual({ success: false, error: "forbidden" });

    mockList.mockRejectedValue(new Error("network down"));
    expect(await fetchAttendanceChangeRequestsAction("proj-1")).toEqual({ success: false, error: "generic" });
  });
});
