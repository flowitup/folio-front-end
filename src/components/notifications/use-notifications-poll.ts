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
import type { DueNotification } from "@/lib/api/notifications";
import { fetchDueNotificationsAction } from "@/components/notifications/actions";

interface UseNotificationsPollOptions {
  intervalMs: number;
  jitterMs: number;
  onUpdate: (items: DueNotification[]) => void;
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

      try {
        const items = await fetchDueNotificationsAction();
        if (!cancelled) onUpdate(items);
      } catch {
        // Swallow — don't disrupt UI; last-known state stays visible
      }

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
