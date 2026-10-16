"use client";

/**
 * ActivityEventRow — one entry of the activity feed (chat, tasks, expenses, attendance,
 * team). The text arrives already written in the viewer's language. Every entry opens
 * what it is about; the few that have nowhere to go (a removal notice, a deleted project)
 * are plain rows with their own "mark as read" control, so a click never silently
 * swallows an entry. The routing mirrors the mobile app's `routeForNotification`.
 */

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import type { ActivityEvent } from "@/lib/api/notifications";
import { pushPath } from "@/lib/navigation/push-path";
import { formatDateTime } from "@/lib/utils/formatters";

export type ActivityTarget =
  | { type: "path"; path: string; projectId?: string }
  | { type: "chat"; channelKey: string };

/** Attendance kinds: they open the project's labor page on the attendance tab. */
const ATTENDANCE_KINDS = new Set([
  "logged",
  "attendance_edited",
  "attendance_deleted",
  "validated",
  "rejected",
  "change_applied",
  "change_refused",
  "submitted",
  "change_requested",
]);

/** Company team and access changes: Settings › Company lists members and roles. */
const COMPANY_KINDS = new Set([
  "member_added",
  "member_role_changed",
  "member_removed",
  "member_left",
  "member_joined",
  "company_member_added",
  "company_member_role_changed",
  "company_member_grants_changed",
  // A chat message was reported: the "Messages signalés" card lives in Settings › Company.
  "chat_report",
]);

const EXPENSE_KINDS = new Set(["invoice_created", "invoice_updated", "invoice_deleted"]);

/** Where an activity entry leads on the web, or null when there is nowhere to go
 * (access was removed, the project was deleted, or the payload lacks the ids). */
export function targetForActivity(event: ActivityEvent, locale: string): ActivityTarget | null {
  const { kind, data } = event;
  const projectId = data.project_id || undefined;
  const project = (rest: string): ActivityTarget | null =>
    projectId ? { type: "path", path: `/${locale}/projects/${projectId}${rest}`, projectId } : null;

  if (kind === "chat_message") {
    return data.channel_key ? { type: "chat", channelKey: data.channel_key } : null;
  }
  if (kind === "billing_status") {
    if (!data.document_id) return null;
    // Quotes are accepted or rejected; invoices are paid or overdue.
    const docKind =
      data.document_kind === "devis" || data.document_kind === "facture"
        ? data.document_kind
        : data.status === "accepted" || data.status === "rejected"
          ? "devis"
          : "facture";
    const section = docKind === "devis" ? "devis" : "factures";
    return { type: "path", path: `/${locale}/billing/${section}/${data.document_id}` };
  }
  if (COMPANY_KINDS.has(kind)) {
    return { type: "path", path: `/${locale}/settings#company` };
  }
  if (kind === "task_assigned" || kind === "task_moved") {
    return project(data.task_id ? `/planning?task=${encodeURIComponent(data.task_id)}` : "/planning");
  }
  if (kind === "refund_requested" || kind === "refund_completed") {
    return project(data.invoice_id ? `/invoices/${data.invoice_id}` : "/invoices");
  }
  if (EXPENSE_KINDS.has(kind)) {
    // A deleted expense has no page of its own any more: open the list.
    return project(data.invoice_id && kind !== "invoice_deleted" ? `/invoices/${data.invoice_id}` : "/invoices");
  }
  if (kind === "worker_added" || kind === "worker_removed") return project("/labor?tab=workers");
  if (ATTENDANCE_KINDS.has(kind)) return project("/labor?tab=attendance");
  if (kind === "invitation_accepted") return project("/members");
  if (kind === "project_member_added" || kind === "project_created") {
    // The project is selected first, so the dashboard opens on it.
    return projectId ? { type: "path", path: `/${locale}/dashboard`, projectId } : null;
  }
  // project_member_removed, company_member_removed, project_deleted and unknown kinds.
  return null;
}

/** The page an entry opens (null for chat, which opens in the drawer, and for dead ends). */
export function pathForActivity(event: ActivityEvent, locale: string): string | null {
  const target = targetForActivity(event, locale);
  return target?.type === "path" ? target.path : null;
}

interface ActivityEventRowProps {
  item: ActivityEvent;
  onOpen: (item: ActivityEvent) => void;
  onNavigate: () => void;
}

export function ActivityEventRow({ item, onOpen, onNavigate }: ActivityEventRowProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const locale = useLocale();
  const { projects, isLoading, selectProject } = useProject();
  const { openChat } = useChat();
  const target = targetForActivity(item, locale);

  function handleClick() {
    if (!target) return;
    if (target.type === "chat") {
      onOpen(item);
      openChat(target.channelKey);
      onNavigate();
      return;
    }
    if (target.projectId) {
      // A project the viewer was removed from (or that was deleted) would only show
      // "page not found": say so instead of switching the whole app to it.
      if (!isLoading && projects.length > 0 && !projects.some((p) => p.id === target.projectId)) {
        onOpen(item);
        toast.error(t("activity.noAccess"));
        return;
      }
      selectProject(target.projectId);
    }
    onOpen(item);
    pushPath(router, target.path);
    onNavigate();
  }

  const content = (
    <>
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
          // Two lines, so the amount and the site at the end of a long body stay readable.
          <span className="line-clamp-2 block break-words text-xs" style={{ color: "var(--muted-foreground)" }}>
            {item.body}
          </span>
        )}
        <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {formatDateTime(item.created_at)}
        </span>
      </span>
    </>
  );
  const fullText = item.body ? `${item.title} — ${item.body}` : item.title;

  if (!target) {
    return (
      <div
        className="flex w-full items-start gap-2 rounded-md px-2 py-2"
        data-unread={item.read ? undefined : "true"}
        title={fullText}
      >
        {content}
        {!item.read && (
          <button
            type="button"
            onClick={() => onOpen(item)}
            aria-label={t("activity.markRead")}
            title={t("activity.markRead")}
            className="mt-0.5 shrink-0 rounded p-1 transition-colors hover:bg-accent/40"
          >
            <Check className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={fullText}
      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/40 focus:outline-none focus-visible:underline"
      data-unread={item.read ? undefined : "true"}
    >
      {content}
    </button>
  );
}
