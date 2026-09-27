/**
 * The drop lane must follow the pointer, not the floating card: when the card
 * is drawn offset from the pointer (zoomed/transformed ancestors), the default
 * rect-intersection strategy dropped cards into the neighbouring lane.
 */

import { describe, it, expect } from "vitest";
import type { ClientRect, CollisionDetection, DroppableContainer } from "@dnd-kit/core";
import { pointerFirstCollision } from "../collision";

type Args = Parameters<CollisionDetection>[0];

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const LANES: Record<string, ClientRect> = {
  "column-in_progress": rect(300, 100, 250, 600),
  "column-blocked": rect(560, 100, 250, 600),
};

function args(pointer: { x: number; y: number } | null, card: ClientRect): Args {
  const droppableRects = new Map(Object.entries(LANES));
  const droppableContainers = Object.keys(LANES).map(
    (id) => ({ id, rect: { current: LANES[id] }, data: { current: {} } }) as unknown as DroppableContainer,
  );
  return {
    active: { id: "task-1" } as Args["active"],
    collisionRect: card,
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer,
  };
}

describe("pointerFirstCollision", () => {
  it("drops into the lane under the pointer even when the card is drawn over the next lane", () => {
    // Pointer in In progress; floating card offset ~160px right, mostly over Blocked.
    const result = pointerFirstCollision(args({ x: 500, y: 300 }, rect(560, 320, 240, 80)));
    expect(result[0]?.id).toBe("column-in_progress");
  });

  it("falls back to the card rectangle when the pointer is over no lane", () => {
    const result = pointerFirstCollision(args({ x: 555, y: 300 }, rect(565, 280, 240, 80)));
    expect(result[0]?.id).toBe("column-blocked");
  });
});
