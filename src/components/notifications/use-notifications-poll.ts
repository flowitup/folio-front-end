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

    const tick = async () => {
      if (cancelled) return;

      if (document.hidden) {
        // Tab is in background — recheck visibility soon instead of full poll
        timer = setTimeout(tick, 5_000);
        return;
      }

      let feed: NotificationsFeed | null;
      try {
        feed = await fetchNotificationsFeedAction();
      } catch {
        // The action call itself failed (offline, server unreachable).
        feed = null;
      }
      if (!cancelled) onUpdate(feed);

      if (cancelled) return;
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

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, jitterMs, onUpdate]);
}
