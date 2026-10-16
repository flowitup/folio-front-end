/**
 * Ask the notifications bell to refetch now instead of at its next poll.
 *
 * Reading a chat channel also reads that channel's entries in the bell (server side);
 * without this the bell badge kept counting them for up to a minute.
 */
export const BELL_REFRESH_EVENT = "folio:bell-refresh";

export function requestBellRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BELL_REFRESH_EVENT));
}
