"use client";

/**
 * NotificationsDropdown — popover content for the notifications bell.
 * Shows skeleton on first load, empty state when no items, or list of NotificationRow.
 */

import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { NotificationRow } from "@/components/notifications/notification-row";
import type { DueNotification } from "@/lib/api/notifications";

interface NotificationsDropdownProps {
  items: DueNotification[];
  isLoading: boolean;
  onDismiss: (noteId: string) => void;
  onClickRow: () => void;
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
  isLoading,
  onDismiss,
  onClickRow,
}: NotificationsDropdownProps) {
  const t = useTranslations("notifications");
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
        ) : items.length === 0 ? (
          // Empty state
          <div
            className="flex flex-col items-center gap-2 py-8 text-center"
            style={{ color: "var(--muted-foreground)" }}
          >
            <BellOff className="h-7 w-7 opacity-40" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          // List
          items.map((item) => (
            <NotificationRow
              key={item.note.id}
              item={item}
              onDismiss={onDismiss}
              onNavigate={onClickRow}
            />
          ))
        )}
      </div>
    </div>
  );
}
