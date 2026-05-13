/**
 * Tests for useCrossProjectConflicts (Phase 4 — cook 4e).
 *
 * Verifies the date-keyed cache: a date-change re-fetches if uncached,
 * stays put if cached. refetch() bypasses the cache.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCrossProjectConflicts } from "../use-cross-project-conflicts";
import * as laborApi from "@/lib/api/labor";

vi.mock("@/lib/api/labor", () => ({
  fetchCrossProjectConflicts: vi.fn(),
}));

const mockFetch = vi.mocked(laborApi.fetchCrossProjectConflicts);

function group(personId: string) {
  return {
    person_id: personId,
    person_name: personId,
    entries: [
      {
        project_id: "px",
        project_name: "Other",
        shift_type: "full" as const,
        supplement_hours: 0,
      },
    ],
  };
}

describe("useCrossProjectConflicts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns empty map until first fetch resolves", async () => {
    mockFetch.mockResolvedValue({ conflicts: [group("p1")] });
    const { result } = renderHook(() =>
      useCrossProjectConflicts({ projectId: "proj", date: "2026-05-13" }),
    );
    expect(result.current.byPersonId.size).toBe(0);
    await waitFor(() => expect(result.current.byPersonId.size).toBe(1));
    expect(result.current.byPersonId.get("p1")?.person_name).toBe("p1");
  });

  it("caches per-date results and skips redundant fetches", async () => {
    mockFetch.mockResolvedValue({ conflicts: [group("p1")] });
    const { result, rerender } = renderHook(
      ({ date }: { date: string }) =>
        useCrossProjectConflicts({ projectId: "proj", date }),
      { initialProps: { date: "2026-05-13" } },
    );
    await waitFor(() => expect(result.current.byPersonId.size).toBe(1));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue({ conflicts: [group("p2")] });
    rerender({ date: "2026-05-14" });
    await waitFor(() => expect(result.current.byPersonId.has("p2")).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(2);

    rerender({ date: "2026-05-13" }); // cached
    await waitFor(() => expect(result.current.byPersonId.has("p1")).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("disabled=false short-circuits to an empty result and skips fetch", () => {
    mockFetch.mockResolvedValue({ conflicts: [group("p1")] });
    const { result } = renderHook(() =>
      useCrossProjectConflicts({
        projectId: "proj",
        date: "2026-05-13",
        enabled: false,
      }),
    );
    expect(result.current.byPersonId.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refetch() bypasses the cache for the active date", async () => {
    mockFetch.mockResolvedValueOnce({ conflicts: [group("p1")] });
    const { result } = renderHook(() =>
      useCrossProjectConflicts({ projectId: "proj", date: "2026-05-13" }),
    );
    await waitFor(() => expect(result.current.byPersonId.size).toBe(1));
    mockFetch.mockResolvedValueOnce({ conflicts: [group("p2")] });
    result.current.refetch();
    await waitFor(() => expect(result.current.byPersonId.has("p2")).toBe(true));
    expect(result.current.byPersonId.has("p1")).toBe(false);
  });
});
