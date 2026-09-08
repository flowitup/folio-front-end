/**
 * useVisiblePoll: fires on mount, re-arms on the interval, restarts on resetKey,
 * refresh() fetches immediately, and nothing fires while disabled.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisiblePoll } from "@/hooks/use-visible-poll";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useVisiblePoll", () => {
  it("fetches on mount and every interval", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const onUpdate = vi.fn();
    renderHook(() => useVisiblePoll({ enabled: true, intervalMs: 1_000, fetcher, onUpdate }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("v");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled, then starts when enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const { rerender } = renderHook(
      ({ enabled }) => useVisiblePoll({ enabled, intervalMs: 1_000, fetcher, onUpdate: vi.fn() }),
      { initialProps: { enabled: false } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("restarts when resetKey changes and refresh() fetches now", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const { result, rerender } = renderHook(
      ({ key }) => useVisiblePoll({ enabled: true, resetKey: key, intervalMs: 10_000, fetcher, onUpdate: vi.fn() }),
      { initialProps: { key: "a" } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender({ key: "b" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("reports errors through onError and keeps polling", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("ok");
    const onError = vi.fn();
    const onUpdate = vi.fn();
    renderHook(() => useVisiblePoll({ enabled: true, intervalMs: 500, fetcher, onUpdate, onError }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onUpdate).toHaveBeenCalledWith("ok");
  });
});
