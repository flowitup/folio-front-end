import { arrayMove } from "@dnd-kit/sortable";
import type { Task } from "@/types/task";

/** The cards a dropped card lands between, as the move API takes them. */
export interface DropNeighbours {
  /** Card right above the drop (`before_id`); none at the top of the lane. */
  beforeId?: string;
  /** Card right below the drop (`after_id`); none at the bottom of the lane. */
  afterId?: string;
}

/**
 * Neighbours for a card dropped onto `overTask` in `lane` (the target lane's
 * tasks, the dragged one included when it comes from the same lane).
 *
 * Within one lane the sortable preview moves the card into the over-card's
 * slot: below it when dragged down, above it when dragged up. Sending "above
 * the over-card" in both cases dropped a card dragged down one slot higher
 * than the preview showed (and onto the next card, not at all). From another
 * lane the card goes above the over-card.
 */
export function dropNeighbours(lane: Task[], dragged: Task, overTask: Task): DropNeighbours {
  const sorted = [...lane].sort((a, b) => a.position - b.position);
  const overIndex = sorted.findIndex((t) => t.id === overTask.id);
  const activeIndex = sorted.findIndex((t) => t.id === dragged.id);

  if (activeIndex !== -1 && overIndex !== -1) {
    const next = arrayMove(sorted, activeIndex, overIndex);
    return { beforeId: next[overIndex - 1]?.id, afterId: next[overIndex + 1]?.id };
  }

  const others = sorted.filter((t) => t.id !== dragged.id);
  const index = others.findIndex((t) => t.id === overTask.id);
  return { beforeId: index > 0 ? others[index - 1].id : undefined, afterId: overTask.id };
}
