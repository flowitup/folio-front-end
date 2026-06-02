"use client";

/**
 * NotificationRow — one row in the notifications dropdown.
 * Clickable area (title + project) navigates to /projects/:id/notes.
 * Dismiss button stops propagation — does not trigger click-through.
 */

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
// useLocale is kept for the navigation URL (locale-prefixed routes)
import type { DueNotification } from "@/lib/api/notifications";

interface NotificationRowProps {
  item: DueNotification;
  onDismiss: (noteId: string) => void;
  onNavigate: () => void;
}

export function NotificationRow({ item, onDismiss, onNavigate }: NotificationRowProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const locale = useLocale();
  const { note } = item;

  function handleClickThrough() {
    router.push(`/${locale}/projects/${note.project_id}/notes`);
    onNavigate();
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    onDismiss(note.id);
  }

  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors">
      {/* Clickable main area */}
      <button
        type="button"
        onClick={handleClickThrough}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:underline"
        aria-label={t("aria.goToNote", { title: note.title })}
      >
        <p
          className="truncate text-sm font-medium leading-snug"
          style={{ color: "var(--foreground)" }}
        >
          {note.title}
        </p>
      </button>

      {/* Dismiss button — separate click target, no navigation */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("dismissButton")}
        className="mt-0.5 shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/10 transition-opacity"
      >
        <X className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
      </button>
    </div>
  );
}
