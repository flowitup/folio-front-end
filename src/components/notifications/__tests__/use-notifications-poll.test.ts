/**
 * Tests for useNotificationsPoll hook.
 *
 * Timer strategy:
 *   vi.useFakeTimers() throughout each test.
 *   vi.advanceTimersByTimeAsync(N) to advance the clock by a bounded amount
 *   and flush any resulting Promise microtasks — avoids the infinite-loop
 *   trap that vi.runAllTimersAsync() hits when setTimeout reschedules itself.
 *
 * Covers:
 * - Fires fetchNotificationsFeedAction immediately on mount
 * - Fires a second time after intervalMs elapses
 * - Does NOT poll when document.hidden = true (schedules 5s recheck instead)
 * - Resumes polling when visibility restored
 * - Cleans up timer and event listener on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---- Module mocks (before imports) ----

vi.mock("../actions", () => ({
  fetchNotificationsFeedAction: vi.fn(),
  dismissNotificationAction: vi.fn(),
}));

// ---- Imports after mocks ----

const { useNotificationsPoll } = await import("../use-notifications-poll");
const { fetchNotificationsFeedAction } = await import("../actions");
const mockFetch = vi.mocked(fetchNotificationsFeedAction);

// ---- Fixture notification ----

const ITEM = {
  note: {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    project_id: "proj-1",
    created_by: "user-1",
    title: "Note",
    description: null,
    category: "general" as const,
    status: "open" as const,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  dismissed: false,
};

// ---- Tests ----

describe("useNotificationsPoll — initial poll on mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // jitter = 0
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls fetchNotificationsFeedAction immediately on mount", async () => {
    mockFetch.mockResolvedValue({ items: [ITEM], attendance: [] });
    const onUpdate = vi.fn();

    renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    // Advance a tiny amount to let the immediate async tick resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("calls onUpdate with returned items after initial poll", async () => {
    mockFetch.mockResolvedValue({ items: [ITEM], attendance: [] });
    const onUpdate = vi.fn();

    renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(onUpdate).toHaveBeenCalledWith({ items: [ITEM], attendance: [] });
  });
});

describe("useNotificationsPoll — interval polling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // jitter = 0
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires a second poll after intervalMs elapses", async () => {
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
    const onUpdate = vi.fn();

    renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    // Let initial tick complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance past the interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000);
});

describe("useNotificationsPoll — visibility API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("does NOT poll when document.hidden is true on mount", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
    const onUpdate = vi.fn();

    renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    // Advance: hook schedules 5s recheck when hidden, not a fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  }, 15000);

  it("fires poll immediately when tab becomes visible", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
    const onUpdate = vi.fn();

    renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    // Initial tick — hidden, so no fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Tab becomes visible — dispatch event then flush
    await act(async () => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  }, 15000);
});

describe("useNotificationsPoll — cleanup on unmount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stops polling after unmount (no further calls after interval)", async () => {
    mockFetch.mockResolvedValue({ items: [], attendance: [] });
    const onUpdate = vi.fn();

    const { unmount } = renderHook(() =>
      useNotificationsPoll({ intervalMs: 60_000, jitterMs: 0, onUpdate })
    );

    // Let initial tick complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    unmount();

    // Advance well past interval — cancelled=true, no more fetches
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  }, 15000);
});
