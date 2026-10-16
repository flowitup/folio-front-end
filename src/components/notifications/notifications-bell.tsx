"use client";

/**
 * NotificationsBell — entry component for the notifications system.
 * Wraps shadcn Popover around a bell button with badge.
 * Polls via useNotificationsPoll; optimistic dismiss / validate / reject with rollback on error.
 * Badge = note reminders + attendance awaiting this user's validation + new members waiting
 * for a project + unread activity (the server's count, the events page being capped).
 */

import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { useNotificationsPoll } from "@/components/notifications/use-notifications-poll";
import { dismissNotificationAction, markActivityReadAction } from "@/components/notifications/actions";
import {
  approveAttendanceChange,
  rejectAttendance,
  rejectAttendanceChange,
  validateAttendance,
} from "@/lib/api/labor";
import type {
  ActivityEvent,
  AttendancePending,
  CompanyEvent,
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
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  // Unread activity beyond the loaded page (the feed returns at most 50 entries).
  const [unreadBeyondPage, setUnreadBeyondPage] = useState(0);
  // Entry ids with a validate/reject request in flight — their buttons are disabled
  // so a double-click cannot fire twice (a second reject would 404 and toast an error).
  const [settlingIds, setSettlingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleUpdate = useCallback((feed: NotificationsFeed | null) => {
    // A failed poll (null) keeps the last-known items rather than clearing the bell.
    if (feed) {
      setItems(feed.items);
      setAttendance(feed.attendance);
      setCompanyEvents(feed.companyEvents ?? []);
      const page = feed.events ?? [];
      setEvents(page);
      const pageUnread = page.filter((e) => !e.read).length;
      setUnreadBeyondPage(Math.max(0, (feed.eventsUnread ?? pageUnread) - pageUnread));
    }
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

  // Reading is optimistic: the entry turns read at once and goes back to unread if the call fails.
  const markRead = useCallback(
    async (ids: string[] | undefined) => {
      const target = ids ? new Set(ids) : null;
      const changed = events.filter((e) => !e.read && (!target || target.has(e.id))).map((e) => e.id);
      if (changed.length === 0 && (ids || unreadBeyondPage === 0)) return;
      const changedSet = new Set(changed);
      setEvents((current) => current.map((e) => (changedSet.has(e.id) ? { ...e, read: true } : e)));
      // "Mark all read" reads the entries beyond the loaded page too.
      const beyond = unreadBeyondPage;
      if (!ids) setUnreadBeyondPage(0);
      const result = await markActivityReadAction(ids);
      if (!result.success) {
        setEvents((current) => current.map((e) => (changedSet.has(e.id) ? { ...e, read: false } : e)));
        if (!ids) setUnreadBeyondPage(beyond);
      }
    },
    [events, unreadBeyondPage]
  );

  const handleOpenEvent = useCallback(
    (event: ActivityEvent) => {
      if (!event.read) void markRead([event.id]);
    },
    [markRead]
  );

  const handleMarkAllRead = useCallback(() => void markRead(undefined), [markRead]);

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

  // A change request on a validated day goes through the change routes: validating
  // or rejecting the day itself would be a no-op or a 409 for it.
  const handleValidate = useCallback(
    (item: AttendancePending) =>
      item.kind === "attendance_change"
        ? settleAttendance(item, approveAttendanceChange, "attendance.changeApplied", "errors.applyChangeFailed")
        : settleAttendance(item, validateAttendance, "attendance.validated", "errors.validateFailed"),
    [settleAttendance]
  );

  const handleReject = useCallback(
    (item: AttendancePending) =>
      item.kind === "attendance_change"
        ? settleAttendance(item, rejectAttendanceChange, "attendance.changeRefused", "errors.refuseChangeFailed")
        : settleAttendance(item, rejectAttendance, "attendance.rejected", "errors.rejectFailed"),
    [settleAttendance]
  );

  // Same total as the server's `count`: new members waiting for a project count too.
  const unreadEvents = events.filter((e) => !e.read).length + unreadBeyondPage;
  const badge = getBadgeLabel(items.length + attendance.length + companyEvents.length + unreadEvents);

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
          companyEvents={companyEvents}
          events={events}
          onOpenEvent={handleOpenEvent}
          onMarkAllRead={handleMarkAllRead}
          unreadEvents={unreadEvents}
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
