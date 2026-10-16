import type { ActivityEvent } from "@/lib/api/notifications";

/**
 * The company named by the newest "you were removed from a company" event of
 * the activity feed, or null when there is none. The event's body is the
 * company's name (see the backend's membership push texts).
 */
export function removedFromCompanyName(events: ActivityEvent[] | undefined | null): string | null {
  const removal = (events ?? [])
    .filter((event) => event.kind === "company_member_removed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const name = removal?.body?.trim();
  return name ? name : null;
}
