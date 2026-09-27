/**
 * Turn "put this item where that one is" into what the reorder endpoints take.
 *
 * The backend places a moved item between the neighbour above (`before_id`)
 * and the neighbour below (`after_id`) its new slot, so the payload is read off
 * the list as it will look after the move, not before.
 */

import type { ReorderPayload } from "@/lib/api/chiffrage";

export interface PlannedMove<T> {
  /** The list in its new order, for an optimistic update. */
  items: T[];
  /** The neighbours of the new slot, as the reorder endpoints expect them. */
  move: Required<ReorderPayload>;
}

/** Move `activeId` into the slot `overId` holds; null when nothing changes. */
export function planMove<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): PlannedMove<T> | null {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1 || from === to) return null;
  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return {
    items: reordered,
    move: {
      before_id: to > 0 ? reordered[to - 1].id : null,
      after_id: to < reordered.length - 1 ? reordered[to + 1].id : null,
    },
  };
}

/** Neighbours of the slot an item was dropped into, in the post-move list. */
export function neighboursAfterMove<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): Required<ReorderPayload> | null {
  return planMove(items, activeId, overId)?.move ?? null;
}

interface RoomedItem {
  id: string;
  room_id: string | null;
  position: number;
}

export type ArticleDrop =
  | { kind: "otherRoom" }
  | { kind: "move"; move: Required<ReorderPayload>; optimisticPosition: number };

/**
 * A drop in a section whose items are shown room by room. A drop on another
 * room's item is refused (the room is a field of the item, changed in Edit).
 * Within a room, the neighbours come from that room's items in position
 * order — what is on screen — not from the section-wide order, which
 * interleaves rooms and would move the item the other way. The optimistic
 * position sits between the new neighbours, so a list sorted by position
 * shows the item where it was dropped until the server answers.
 */
export function planArticleDrop<T extends RoomedItem>(
  items: T[],
  activeId: string,
  overId: string,
): ArticleDrop | null {
  const moving = items.find((a) => a.id === activeId);
  const target = items.find((a) => a.id === overId);
  if (!moving || !target || moving.id === target.id) return null;
  if (moving.room_id !== target.room_id) return { kind: "otherRoom" };
  const roomItems = items
    .filter((a) => a.room_id === moving.room_id)
    .sort((a, b) => a.position - b.position);
  const plan = planMove(roomItems, activeId, overId);
  if (!plan) return null;
  const byId = new Map(items.map((a) => [a.id, a]));
  const before = plan.move.before_id ? byId.get(plan.move.before_id) : undefined;
  const after = plan.move.after_id ? byId.get(plan.move.after_id) : undefined;
  const optimisticPosition =
    before && after
      ? (before.position + after.position) / 2
      : before
        ? before.position + 1
        : after
          ? after.position - 1
          : moving.position;
  return { kind: "move", move: plan.move, optimisticPosition };
}
