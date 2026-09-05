"use client";

/**
 * NotificationsDropdown — popover content for the notifications bell.
 * Shows skeleton on first load, empty state when nothing is due, otherwise the
 * attendance-to-validate section (managers) followed by note reminders.
 */

import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { AttendancePendingRow } from "@/components/notifications/attendance-pending-row";
import { NotificationRow } from "@/components/notifications/notification-row";
import type { AttendancePending, DueNotification } from "@/lib/api/notifications";

interface NotificationsDropdownProps {
  items: DueNotification[];
  /** Worker-submitted days awaiting this user's validation. Defaults to none. */
  attendance?: AttendancePending[];
  isLoading: boolean;
  onDismiss: (noteId: string) => void;
  onValidate?: (item: AttendancePending) => void;
  onReject?: (item: AttendancePending) => void;
  /** Entry ids whose validate/reject request is in flight (buttons disabled). */
  settlingIds?: ReadonlySet<string>;
  onClickRow: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </p>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-2 animate-pulse">
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3.5 w-3/4 rounded"
          style={{ background: "var(--accent)" }}
        />
        <div
          className="h-2.5 w-1/3 rounded"
          style={{ background: "var(--accent)" }}
        />
      </div>
      <div
        className="mt-0.5 h-5 w-5 shrink-0 rounded"
        style={{ background: "var(--accent)" }}
      />
    </div>
  );
}

export function NotificationsDropdown({
  items,
  attendance = [],
  isLoading,
  onDismiss,
  onValidate,
  onReject,
  settlingIds,
  onClickRow,
}: NotificationsDropdownProps) {
  const t = useTranslations("notifications");
  const isEmpty = items.length === 0 && attendance.length === 0;
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="border-b px-3 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </p>
      </div>

      {/* Body */}
      <div className="max-h-[360px] overflow-y-auto px-1 py-1">
        {isLoading ? (
          // Skeleton — first load only
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : isEmpty ? (
          // Empty state
          <div
            className="flex flex-col items-center gap-2 py-8 text-center"
            style={{ color: "var(--muted-foreground)" }}
          >
            <BellOff className="h-7 w-7 opacity-40" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <>
            {attendance.length > 0 && (
              <section aria-label={t("attendance.title")}>
                <SectionLabel>{t("attendance.title")}</SectionLabel>
                {attendance.map((item) => (
                  <AttendancePendingRow
                    key={item.entry_id}
                    item={item}
                    busy={settlingIds?.has(item.entry_id) ?? false}
                    onValidate={onValidate}
                    onReject={onReject}
                    onNavigate={onClickRow}
                  />
                ))}
              </section>
            )}
            {items.length > 0 && (
              <section aria-label={t("title")}>
                {attendance.length > 0 && <SectionLabel>{t("title")}</SectionLabel>}
                {items.map((item) => (
                  <NotificationRow
                    key={item.note.id}
                    item={item}
                    onDismiss={onDismiss}
                    onNavigate={onClickRow}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
