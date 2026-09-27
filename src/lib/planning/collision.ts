import { pointerWithin, rectIntersection } from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";

/**
 * Drop target = whatever is under the pointer; fall back to the floating
 * card's rectangle only when the pointer is over no droppable (e.g. in the gap
 * between two lanes). The default rectIntersection alone follows the floating
 * card, so any offset between card and pointer drops into the wrong lane.
 */
export const pointerFirstCollision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};
