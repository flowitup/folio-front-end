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
