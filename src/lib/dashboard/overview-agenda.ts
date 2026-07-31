/**
 * Pure agenda grouping for the dashboard "This week" card (design Canvas 3a).
 * Split out from overview-metrics.ts to keep each aggregation file focused.
 */
import type { Task } from "@/types/task";
import { toDateKey, startOfWeekMonday, addWeeks } from "@/lib/planning/week";

export type AgendaGroupKey = "overdue" | "today" | "thisWeek";
export const AGENDA_GROUP_ORDER: readonly AgendaGroupKey[] = ["overdue", "today", "thisWeek"];

export interface AgendaGroup {
  key: AgendaGroupKey;
  tasks: Task[];
}

/**
 * Groups non-done tasks with a due date into Overdue / Today / This week
 * (Monday–Sunday, matching the planning week view), capped at `maxItems`
 * total across groups — empty groups are omitted entirely. Tasks without a
 * due date, or due later than the current week, are excluded: the agenda is
 * a short "what's next" list, not the full board.
 */
export function groupAgendaTasks(
  tasks: Task[],
  referenceDate: Date = new Date(),
  maxItems = 6
): AgendaGroup[] {
  const todayKey = toDateKey(referenceDate);
  const weekStart = startOfWeekMonday(referenceDate);
  // Exclusive upper bound: the following Monday.
  const weekEndKey = toDateKey(addWeeks(weekStart, 1));

  const byGroup: Record<AgendaGroupKey, Task[]> = { overdue: [], today: [], thisWeek: [] };
  const eligible = tasks
    .filter((t) => t.status !== "done" && !!t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0));

  for (const task of eligible) {
    const due = task.due_date!;
    if (due < todayKey) byGroup.overdue.push(task);
    else if (due === todayKey) byGroup.today.push(task);
    else if (due < weekEndKey) byGroup.thisWeek.push(task);
  }

  // Cap total items across groups (Overdue/Today take priority over This
  // week), then drop any group left empty by the cap.
  let remaining = maxItems;
  return AGENDA_GROUP_ORDER.map((key) => {
    const capped = byGroup[key].slice(0, Math.max(remaining, 0));
    remaining -= capped.length;
    return { key, tasks: capped };
  }).filter((g) => g.tasks.length > 0);
}
