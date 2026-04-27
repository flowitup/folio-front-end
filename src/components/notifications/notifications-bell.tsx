"use client";

/**
 * NotificationsBell — entry component for the notifications system.
 * Wraps shadcn Popover around a bell button with badge.
 * Polls via useNotificationsPoll; optimistic dismiss with rollback on error.
 */

import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { useNotificationsPoll } from "@/components/notifications/use-notifications-poll";
import { dismissNotificationAction } from "@/components/notifications/actions";
import type { DueNotification } from "@/lib/api/notifications";

function getBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationsBell() {
  const [items, setItems] = useState<DueNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleUpdate = useCallback((updated: DueNotification[]) => {
    setItems(updated);
    setHasLoaded(true);
  }, []);

  useNotificationsPoll({
    intervalMs: 60_000,
    jitterMs: 10_000,
    onUpdate: handleUpdate,
  });

  const handleDismiss = useCallback(
    async (noteId: string) => {
      const prev = items;
      // Optimistic update — remove immediately
      setItems((current) => current.filter((i) => i.note.id !== noteId));

      const result = await dismissNotificationAction(noteId);
      if (!result.success) {
        // Rollback on failure
        setItems(prev);
        toast.error("Could not dismiss reminder — please try again.");
      }
    },
    [items]
  );

  const badge = getBadgeLabel(items.length);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="btn btn-quiet relative"
          aria-label="View notifications"
        >
          <Bell size={16} />
          {badge && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-semibold leading-none"
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-96 p-0">
        <NotificationsDropdown
          items={items}
          isLoading={!hasLoaded}
          onDismiss={handleDismiss}
          onClickRow={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
