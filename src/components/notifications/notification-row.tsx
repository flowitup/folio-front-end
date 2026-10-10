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
import { useProject } from "@/context/ProjectContext";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { formatDate } from "@/lib/utils/formatters";

/** Today as YYYY-MM-DD in the viewer's time zone (ISO dates compare as strings). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface NotificationRowProps {
  item: DueNotification;
  onDismiss: (noteId: string) => void;
  onNavigate: () => void;
}

export function NotificationRow({ item, onDismiss, onNavigate }: NotificationRowProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const locale = useLocale();
  const { projects, selectProject } = useProject();
  const { note } = item;
  // Reminders with the same title in two projects must be told apart.
  const project = projects.find((p) => p.id === note.project_id);
  // An overdue reminder must stand out from today's.
  const overdue = !!note.due_date && note.due_date < todayIso();

  function handleClickThrough() {
    // Keep the breadcrumb and project switcher on the note's project.
    selectProject(note.project_id);
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
          {project && (
            <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
              {" · "}
              {projectDisplayName(project)}
            </span>
          )}
        </p>
        {note.due_date && (
          <p
            className="num mt-0.5 text-xs"
            style={{ color: overdue ? "var(--negative)" : "var(--muted-foreground)" }}
          >
            {t("due", { date: formatDate(note.due_date) })}
          </p>
        )}
      </button>

      {/* Dismiss button — separate click target, no navigation. Revealed on
          hover only where the device can hover: on a touch screen it is
          always shown, or phone users would never find it. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("dismissButton")}
        className="mt-0.5 shrink-0 rounded p-1 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/10 transition-opacity"
      >
        <X className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
      </button>
    </div>
  );
}
