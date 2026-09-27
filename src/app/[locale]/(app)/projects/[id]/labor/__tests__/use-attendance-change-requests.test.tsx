/**
 * useAttendanceChangeRequests — the labor page's manager side of worker
 * change requests: loading, merging with the loaded entries, and deciding.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { ApiError } from "@/lib/api/http";
import type { AttendanceChangeRequest, LaborEntry } from "@/types/labor";
import { useAttendanceChangeRequests } from "../use-attendance-change-requests";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, string>) =>
    vars?.worker ? `${ns}.${key}:${vars.worker}` : `${ns}.${key}`,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/api/labor", () => ({
  approveAttendanceChange: vi.fn(),
  rejectAttendanceChange: vi.fn(),
}));

vi.mock("../actions", () => ({
  fetchAttendanceChangeRequestsAction: vi.fn(),
}));

const { fetchAttendanceChangeRequestsAction } = await import("../actions");
const { approveAttendanceChange, rejectAttendanceChange } = await import("@/lib/api/labor");
const { toast } = await import("sonner");
const mockFetch = vi.mocked(fetchAttendanceChangeRequestsAction);
const mockApprove = vi.mocked(approveAttendanceChange);
const mockReject = vi.mocked(rejectAttendanceChange);

const FEED_REQUEST: AttendanceChangeRequest = {
  entry_id: "e-feed",
  worker_id: "w2",
  worker_name: "Tran",
  date: "2026-08-14",
  shift_type: "full",
  supplement_hours: 0,
  note: null,
  proposed_shift_type: "half",
  proposed_supplement_hours: 0,
  proposed_note: null,
  requested_at: "2026-09-01T08:00:00",
};

const ENTRY_WITH_REQUEST: LaborEntry = {
  id: "e-entry",
  worker_id: "w1",
  worker_name: "Tho",
  date: "2026-09-06",
  amount_override: null,
  effective_cost: 120,
  note: null,
  shift_type: "full",
  supplement_hours: 0,
  created_at: "2026-09-06T06:00:00",
  status: "validated",
  change_requested_at: "2026-09-08T18:00:00",
  proposed_shift_type: "overtime",
  proposed_supplement_hours: 1,
  proposed_note: null,
};

const PLAIN_ENTRY: LaborEntry = {
  ...ENTRY_WITH_REQUEST,
  id: "e-plain",
  change_requested_at: null,
  proposed_shift_type: null,
  proposed_supplement_hours: null,
};

function setup(options: { enabled?: boolean; entries?: LaborEntry[] } = {}) {
  const onDecided = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(
    (props: { enabled: boolean; entries: LaborEntry[] }) =>
      useAttendanceChangeRequests({ projectId: "proj-1", onDecided, ...props }),
    { initialProps: { enabled: options.enabled ?? true, entries: options.entries ?? [] } },
  );
  return { ...hook, onDecided };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ success: true, data: [FEED_REQUEST] });
});

describe("useAttendanceChangeRequests — loading", () => {
  it("merges the project's feed requests with the loaded entries' requests, newest day first", async () => {
    const { result } = setup({ entries: [PLAIN_ENTRY, ENTRY_WITH_REQUEST] });

    await waitFor(() => expect(result.current.requests).toHaveLength(2));
    expect(mockFetch).toHaveBeenCalledWith("proj-1");
    expect(result.current.requests.map((r) => r.entry_id)).toEqual(["e-entry", "e-feed"]);
    expect(result.current.loadFailed).toBe(false);
  });

  it("does not load anything for a user who cannot decide", async () => {
    const { result } = setup({ enabled: false, entries: [ENTRY_WITH_REQUEST] });
    await act(async () => {});
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.requests).toEqual([]);
  });

  it("flags a failed load and clears it on a successful retry", async () => {
    mockFetch.mockResolvedValueOnce({ success: false, error: "generic" });
    const { result } = setup();
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.requests).toEqual([]);

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.requests).toEqual([FEED_REQUEST]);
  });
});

describe("useAttendanceChangeRequests — deciding", () => {
  it("apply calls the change route, toasts, refreshes and drops the request", async () => {
    mockApprove.mockResolvedValue(undefined);
    const { result, onDecided } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    mockFetch.mockResolvedValue({ success: true, data: [] });

    await act(async () => {
      result.current.approve(FEED_REQUEST);
    });

    await waitFor(() => expect(result.current.requests).toEqual([]));
    expect(mockApprove).toHaveBeenCalledWith("proj-1", "e-feed");
    expect(toast.success).toHaveBeenCalledWith("labor.changeRequest.applied:Tran");
    expect(onDecided).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.settlingIds.size).toBe(0);
  });

  it("ignores a second click while the first decision is in flight", async () => {
    let resolve: () => void = () => {};
    mockApprove.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const { result } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    act(() => {
      result.current.approve(FEED_REQUEST);
      result.current.approve(FEED_REQUEST);
    });
    expect(result.current.settlingIds.has("e-feed")).toBe(true);
    await act(async () => resolve());

    expect(mockApprove).toHaveBeenCalledTimes(1);
  });

  it("treats a 409 (already settled elsewhere) as done and refreshes", async () => {
    mockApprove.mockRejectedValue(new ApiError("conflict", 409));
    const { result, onDecided } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    await act(async () => {
      result.current.approve(FEED_REQUEST);
    });

    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalledWith("labor.changeRequest.alreadySettled:Tran");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a failed apply toasts the error and keeps the request", async () => {
    mockApprove.mockRejectedValue(new ApiError("boom", 500));
    const { result, onDecided } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    await act(async () => {
      result.current.approve(FEED_REQUEST);
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("labor.changeRequest.applyFailed"));
    expect(onDecided).not.toHaveBeenCalled();
    expect(result.current.requests).toEqual([FEED_REQUEST]);
    expect(result.current.settlingIds.size).toBe(0);
  });

  it("refusing goes through the confirmation, then the reject-change route", async () => {
    mockReject.mockResolvedValue(undefined);
    const { result } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    act(() => result.current.requestRefuse(FEED_REQUEST));
    expect(result.current.refusing).toEqual(FEED_REQUEST);
    expect(mockReject).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmRefuse();
    });
    expect(mockReject).toHaveBeenCalledWith("proj-1", "e-feed");
    expect(toast.success).toHaveBeenCalledWith("labor.changeRequest.refused:Tran");
    expect(result.current.refusing).toBeNull();
  });

  it("keeps the confirmation open when the refusal fails, and cancel closes it", async () => {
    mockReject.mockRejectedValue(new Error("network"));
    const { result } = setup();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    act(() => result.current.requestRefuse(FEED_REQUEST));
    await act(async () => {
      await result.current.confirmRefuse();
    });
    expect(toast.error).toHaveBeenCalledWith("labor.changeRequest.refuseFailed");
    expect(result.current.refusing).toEqual(FEED_REQUEST);

    act(() => result.current.cancelRefuse());
    expect(result.current.refusing).toBeNull();
  });
});
