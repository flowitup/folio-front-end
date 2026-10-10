"use client";

/**
 * ActivityEventRow — one entry of the activity feed (chat, tasks, invoices, membership).
 * The text arrives already written in the viewer's language. Clicking marks it read and,
 * when the payload names a screen that exists on the web, opens it.
 */

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import type { ActivityEvent } from "@/lib/api/notifications";
import { formatDateTime } from "@/lib/utils/formatters";

/** Where an activity entry lands on the web, or null when it has no page of its own
 * (chat lives in the drawer, quote status has no per-document page). */
export function pathForActivity(event: ActivityEvent, locale: string): string | null {
  const { kind, data } = event;
  const projectId = data.project_id;
  if (!projectId) return null;
  if (kind === "task_assigned" || kind === "task_moved") {
    return `/${locale}/projects/${projectId}/planning`;
  }
  if ((kind === "refund_requested" || kind === "refund_completed") && data.invoice_id) {
    return `/${locale}/projects/${projectId}/invoices/${data.invoice_id}`;
  }
  if (kind === "invitation_accepted") return `/${locale}/projects/${projectId}/members`;
  return null;
}

interface ActivityEventRowProps {
  item: ActivityEvent;
  onOpen: (item: ActivityEvent) => void;
  onNavigate: () => void;
}

export function ActivityEventRow({ item, onOpen, onNavigate }: ActivityEventRowProps) {
  const router = useRouter();
  const locale = useLocale();
  const { selectProject } = useProject();

  function handleClick() {
    onOpen(item);
    const path = pathForActivity(item, locale);
    if (path) {
      if (item.data.project_id) selectProject(item.data.project_id);
      router.push(path);
      onNavigate();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/40 focus:outline-none focus-visible:underline"
      data-unread={item.read ? undefined : "true"}
    >
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: item.read ? "transparent" : "var(--accent)" }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${item.read ? "" : "font-medium"}`}
          style={{ color: "var(--foreground)" }}
        >
          {item.title}
        </span>
        {item.body && (
          <span className="block truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
            {item.body}
          </span>
        )}
        <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {formatDateTime(item.created_at)}
        </span>
      </span>
    </button>
  );
}
