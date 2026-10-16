/**
 * useNotificationsPoll — custom hook for polling due notifications.
 * Features:
 *   - Fires immediately on mount
 *   - Jitter on interval to avoid thundering-herd across tabs
 *   - Visibility API: pauses polling when document is hidden, resumes immediately on focus
 *   - Full cleanup on unmount: cancelled flag + clearTimeout + removeEventListener
 */

"use client";

import { useEffect } from "react";
import type { NotificationsFeed } from "@/lib/api/notifications";
import { fetchNotificationsFeedAction } from "@/components/notifications/actions";
import { BELL_REFRESH_EVENT } from "@/lib/notifications/bell-refresh";

interface UseNotificationsPollOptions {
  intervalMs: number;
  jitterMs: number;
  /** Called after every poll; `null` when the poll failed (keep the last-known feed). */
  onUpdate: (feed: NotificationsFeed | null) => void;
}

export function useNotificationsPoll({
  intervalMs,
  jitterMs,
  onUpdate,
}: UseNotificationsPollOptions): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // One fetch at a time: a refresh asked for mid-fetch runs right after it instead of
    // starting a second polling loop.
    let inFlight = false;
    let rerun = false;

    const tick = async () => {
      if (cancelled) return;
      if (inFlight) {
        rerun = true;
        return;
      }

      if (document.hidden) {
        // Tab is in background — recheck visibility soon instead of full poll
        timer = setTimeout(tick, 5_000);
        return;
      }

      let feed: NotificationsFeed | null;
      inFlight = true;
      try {
        feed = await fetchNotificationsFeedAction();
      } catch {
        // The action call itself failed (offline, server unreachable).
        feed = null;
      } finally {
        inFlight = false;
      }
      if (!cancelled) onUpdate(feed);

      if (cancelled) return;
      if (rerun) {
        rerun = false;
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, 0);
        return;
      }
      const jitter = Math.floor((Math.random() - 0.5) * 2 * jitterMs);
      timer = setTimeout(tick, intervalMs + jitter);
    };

    // Fire immediately on mount
    void tick();

    const onVisibilityChange = () => {
      if (!document.hidden && !cancelled) {
        // Tab became visible — fire poll immediately (cancel pending recheck first)
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void tick();
      }
    };

    // Something elsewhere in the app changed what the bell shows (e.g. a chat was read).
    const onRefreshRequest = () => {
      if (cancelled || document.hidden) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void tick();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(BELL_REFRESH_EVENT, onRefreshRequest);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(BELL_REFRESH_EVENT, onRefreshRequest);
    };
  }, [intervalMs, jitterMs, onUpdate]);
}
