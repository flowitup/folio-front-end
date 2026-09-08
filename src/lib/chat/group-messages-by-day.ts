/**
 * Groups chat messages (already oldest → newest) under day dividers and decides when
 * consecutive messages from the same sender share one name/avatar header.
 * Same rules as the mobile app (`src/lib/chat/group-messages-by-day.ts` there), so both
 * clients render a thread identically.
 */

export interface DayGroup<T> {
  /** Local-calendar `YYYY-MM-DD` of the divider. */
  dayKey: string;
  messages: T[];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local-calendar `YYYY-MM-DD` of a date. */
export function toLocalDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local-calendar `YYYY-MM-DD` of an ISO timestamp. */
export function dayKeyOf(iso: string): string {
  return toLocalDayKey(new Date(iso));
}

export function groupMessagesByDay<T extends { created_at: string }>(messages: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const message of messages) {
    const dayKey = dayKeyOf(message.created_at);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.messages.push(message);
    else groups.push({ dayKey, messages: [message] });
  }
  return groups;
}

/**
 * Divider label: a "today" / "yesterday" token (translated by the caller) or `dd/mm`.
 */
export function dayDividerLabel(
  dayKey: string,
  today: Date = new Date()
): { token: "today" | "yesterday" } | { date: string } {
  if (dayKey === toLocalDayKey(today)) return { token: "today" };
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey === toLocalDayKey(yesterday)) return { token: "yesterday" };
  return { date: `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}` };
}

/** `HH:mm` in local time. */
export function timeOf(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Whether a message shows the sender header (first of a run from one sender, never mine). */
export function showsSender<T extends { sender_id: string; mine: boolean }>(
  messages: T[],
  index: number
): boolean {
  const current = messages[index];
  if (current.mine) return false;
  const previous = messages[index - 1];
  return !previous || previous.sender_id !== current.sender_id;
}
