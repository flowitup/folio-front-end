/**
 * Tests for useLastLoggedDay (Phase 3e).
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLastLoggedDay } from "../use-last-logged-day";
import type { LaborEntry } from "@/types/labor";

function entry(workerId: string, date: string, opts: Partial<LaborEntry> = {}): LaborEntry {
  return {
    id: `${workerId}-${date}`,
    worker_id: workerId,
    worker_name: workerId,
    date,
    amount_override: null,
    effective_cost: 100,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: `${date}T00:00:00Z`,
    ...opts,
  };
}

describe("useLastLoggedDay", () => {
  it("returns null + empty list on no entries", () => {
    const { result } = renderHook(() => useLastLoggedDay([]));
    expect(result.current.date).toBeNull();
    expect(result.current.workers).toEqual([]);
  });

  it("finds the most recent date + collects workers on that day", () => {
    const { result } = renderHook(() =>
      useLastLoggedDay([
        entry("w1", "2026-05-10"),
        entry("w2", "2026-05-13", { shift_type: "half", supplement_hours: 2 }),
        entry("w3", "2026-05-13"),
      ]),
    );
    expect(result.current.date).toBe("2026-05-13");
    expect(result.current.workers).toHaveLength(2);
    expect(result.current.workers).toContainEqual({
      worker_id: "w2",
      shift_type: "half",
      supplement_hours: 2,
    });
  });

  it("dedupes by worker_id within the last day", () => {
    const { result } = renderHook(() =>
      useLastLoggedDay([
        entry("w1", "2026-05-13"),
        entry("w1", "2026-05-13", { id: "dup" }),
      ]),
    );
    expect(result.current.workers).toHaveLength(1);
  });

  it("defaults a null shift_type to 'full'", () => {
    const { result } = renderHook(() =>
      useLastLoggedDay([
        entry("w1", "2026-05-13", { shift_type: null, supplement_hours: 4 }),
      ]),
    );
    expect(result.current.workers[0].shift_type).toBe("full");
  });
});
