import type { TaskPriority } from "@/types/task";

/**
 * Priority → status-dot variant (globals.css), shared by the board, the
 * backlog and the week view so they read alike. The colours escalate with the
 * priority: grey (low) → mustard (medium) → orange (high) → red (urgent).
 * Medium used to be the bright orange and high the muted mustard, so medium
 * looked more urgent than high.
 */
export const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  low: "muted",
  medium: "warning",
  high: "accent",
  urgent: "negative",
};

/** Priorities important enough to be named in words on a card, not only by colour. */
export function showsPriorityTag(priority: TaskPriority): boolean {
  return priority === "high" || priority === "urgent";
}
