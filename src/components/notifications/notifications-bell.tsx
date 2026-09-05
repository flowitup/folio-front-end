"use client";

/**
 * NotificationsBell — entry component for the notifications system.
 * Wraps shadcn Popover around a bell button with badge.
 * Polls via useNotificationsPoll; optimistic dismiss / validate / reject with rollback on error.
 * Badge = note reminders + attendance entries awaiting this user's validation.
 */

import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { useNotificationsPoll } from "@/components/notifications/use-notifications-poll";
import { dismissNotificationAction } from "@/components/notifications/actions";
import { rejectAttendance, validateAttendance } from "@/lib/api/labor";
import type {
  AttendancePending,
  DueNotification,
  NotificationsFeed,
} from "@/lib/api/notifications";

function getBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationsBell() {
  const t = useTranslations("notifications");
  const [items, setItems] = useState<DueNotification[]>([]);
  const [attendance, setAttendance] = useState<AttendancePending[]>([]);
  // Entry ids with a validate/reject request in flight — their buttons are disabled
  // so a double-click cannot fire twice (a second reject would 404 and toast an error).
  const [settlingIds, setSettlingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleUpdate = useCallback((feed: NotificationsFeed) => {
    setItems(feed.items);
    setAttendance(feed.attendance);
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
        toast.error(t("errors.dismissFailed"));
      }
    },
    [items, t]
  );

  // Validate / reject share the same optimistic-remove + rollback shape. Both the
  // removal and the restore are functional updates so a poll tick landing mid-flight
  // (with, say, a new submission) is never clobbered by a stale snapshot.
  const settleAttendance = useCallback(
    async (
      item: AttendancePending,
      action: (projectId: string, entryId: string) => Promise<void>,
      successKey: string,
      errorKey: string
    ) => {
      let alreadyInFlight = false;
      setSettlingIds((current) => {
        if (current.has(item.entry_id)) {
          alreadyInFlight = true;
          return current;
        }
        return new Set(current).add(item.entry_id);
      });
      if (alreadyInFlight) return;
      setAttendance((current) => current.filter((a) => a.entry_id !== item.entry_id));
      try {
        await action(item.project_id, item.entry_id);
        toast.success(t(successKey, { worker: item.worker_name }));
      } catch {
        setAttendance((current) =>
          current.some((a) => a.entry_id === item.entry_id) ? current : [item, ...current]
        );
        toast.error(t(errorKey));
      } finally {
        setSettlingIds((current) => {
          const next = new Set(current);
          next.delete(item.entry_id);
          return next;
        });
      }
    },
    [t]
  );

  const handleValidate = useCallback(
    (item: AttendancePending) =>
      settleAttendance(item, validateAttendance, "attendance.validated", "errors.validateFailed"),
    [settleAttendance]
  );

  const handleReject = useCallback(
    (item: AttendancePending) =>
      settleAttendance(item, rejectAttendance, "attendance.rejected", "errors.rejectFailed"),
    [settleAttendance]
  );

  const badge = getBadgeLabel(items.length + attendance.length);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="btn btn-quiet relative"
          aria-label={t("aria.bell")}
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
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[calc(100vw-1rem)] max-w-96 p-0"
      >
        <NotificationsDropdown
          items={items}
          attendance={attendance}
          isLoading={!hasLoaded}
          onDismiss={handleDismiss}
          onValidate={handleValidate}
          onReject={handleReject}
          settlingIds={settlingIds}
          onClickRow={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
