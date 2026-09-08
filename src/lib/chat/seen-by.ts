/**
 * "Seen" receipts: which members have read up to which message.
 *
 * Each member carries the read marker of the channel (`last_read_at`). A member is shown
 * once, under the newest message created at or before that marker — the Messenger
 * convention — and never under their own messages or for the viewer themself.
 * Ported verbatim from the mobile app so both clients agree on who saw what.
 */

export interface SeenMember {
  id: string;
  name: string;
  last_read_at?: string | null;
}

interface SeenMessage {
  id: string;
  created_at: string;
  sender_id: string;
}

/** Message id → members whose read marker lands on that message (order = members order). */
export function seenByMessage<M extends SeenMember, T extends SeenMessage>(
  messages: T[],
  members: M[],
  viewerId: string | null | undefined
): Map<string, M[]> {
  const result = new Map<string, M[]>();
  if (messages.length === 0) return result;
  for (const member of members) {
    if (!member.last_read_at || member.id === viewerId) continue;
    const readAt = Date.parse(member.last_read_at);
    if (Number.isNaN(readAt)) continue;
    // Newest message at or before the marker (messages arrive oldest → newest).
    let seen: T | undefined;
    for (const message of messages) {
      if (Date.parse(message.created_at) <= readAt) seen = message;
      else break;
    }
    if (!seen || seen.sender_id === member.id) continue;
    const list = result.get(seen.id) ?? [];
    list.push(member);
    result.set(seen.id, list);
  }
  return result;
}
