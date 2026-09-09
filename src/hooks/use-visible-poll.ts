"use client";

/**
 * useVisiblePoll — generic polling hook for browser-direct fetches.
 *   - fires immediately when enabled, then every `intervalMs` ± `jitterMs`
 *   - pauses while the tab is hidden (Page Visibility API) and refetches on return; the very
 *     first fetch runs even in a background tab so the data is ready when the user switches
 *   - `refresh()` fetches now (after a send, on channel switch) and re-arms the timer
 *   - a stale response (superseded by a newer tick, or after unmount) is dropped
 *   - consecutive failures back off (interval × 2^n, capped at 60 s) so a dead session or a
 *     down backend is not hammered every few seconds; a success resets the cadence
 *
 * Generalised from `use-notifications-poll.ts`; the fetcher/onUpdate callbacks are read
 * through refs so callers may pass inline closures without restarting the loop.
 */

import { useCallback, useEffect, useRef } from "react";

/** Longest pause between two attempts once the fetcher keeps failing. */
export const MAX_BACKOFF_MS = 60_000;

interface UseVisiblePollOptions<T> {
  enabled: boolean;
  /** Changing this restarts the loop (abort in-flight, fetch now) — e.g. the channel key. */
  resetKey?: string | null;
  intervalMs: number;
  jitterMs?: number;
  fetcher: (signal: AbortSignal) => Promise<T>;
  onUpdate: (value: T) => void;
  onError?: (error: unknown) => void;
}

export function useVisiblePoll<T>({
  enabled,
  resetKey = null,
  intervalMs,
  jitterMs = 0,
  fetcher,
  onUpdate,
  onError,
}: UseVisiblePollOptions<T>): { refresh: () => Promise<void> } {
  const fetcherRef = useRef(fetcher);
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);
  // Synced in an effect (not during render): React may discard a render, and a fetcher
  // closed over uncommitted props must never drive a tick. Declared before the poll effect
  // so a resetKey restart already sees the fresh callbacks.
  useEffect(() => {
    fetcherRef.current = fetcher;
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  });

  // Mutable loop state shared between the effect and refresh().
  const loop = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    controller: AbortController | null;
    run: number;
    active: boolean;
    failures: number;
  }>({ timer: null, controller: null, run: 0, active: false, failures: 0 });

  const clearTimer = () => {
    if (loop.current.timer) {
      clearTimeout(loop.current.timer);
      loop.current.timer = null;
    }
  };

  const schedule = useCallback(
    (delay: number) => {
      clearTimer();
      loop.current.timer = setTimeout(() => void tick(), delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intervalMs, jitterMs]
  );

  const tick = useCallback(async () => {
    const state = loop.current;
    if (!state.active) return;
    // A pending timer (interval or hidden-tab recheck) must not race the fetch we start now.
    clearTimer();
    if (typeof document !== "undefined" && document.hidden && state.run > 0) {
      // Background tab (after the first fetch): recheck soon instead of hitting the API.
      schedule(5_000);
      return;
    }
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    const run = ++state.run;
    try {
      const value = await fetcherRef.current(controller.signal);
      if (state.active && run === state.run) {
        state.failures = 0;
        onUpdateRef.current(value);
      }
    } catch (error) {
      if (state.active && run === state.run && !controller.signal.aborted) {
        state.failures += 1;
        onErrorRef.current?.(error);
      }
    }
    if (!state.active || run !== state.run) return;
    const jitter = jitterMs ? Math.floor((Math.random() - 0.5) * 2 * jitterMs) : 0;
    const backoff = Math.min(intervalMs * 2 ** state.failures, MAX_BACKOFF_MS);
    schedule(Math.max(backoff, intervalMs) + jitter);
  }, [intervalMs, jitterMs, schedule]);

  useEffect(() => {
    const state = loop.current;
    if (!enabled) return;
    state.active = true;
    state.failures = 0;
    void tick();

    const onVisibilityChange = () => {
      if (!document.hidden && state.active) void tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      state.active = false;
      state.run += 1;
      state.controller?.abort();
      state.controller = null;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, resetKey, tick]);

  const refresh = useCallback(async () => {
    if (!loop.current.active) return;
    await tick();
  }, [tick]);

  return { refresh };
}
