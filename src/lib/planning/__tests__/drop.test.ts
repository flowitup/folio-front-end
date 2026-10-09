/**
 * A card dropped onto another card must land where the sortable preview drew
 * it. Dragged DOWN inside its lane the preview puts it below the over-card;
 * the board always sent "above the over-card", so T1 dropped on T3 landed
 * between T2 and T3, and T1 dropped on T2 did not move at all.
 */

import { describe, it, expect } from "vitest";
import { dropNeighbours } from "../drop";
import type { Task, TaskStatus } from "@/types/task";

function task(id: string, position: number, status: TaskStatus = "todo"): Task {
  return {
    id,
    project_id: "p1",
    title: id,
    description: null,
    status,
    priority: "medium",
    assignee_id: null,
    due_date: null,
    position,
    labels: [],
    created_by: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

const T1 = task("T1", 1000);
const T2 = task("T2", 2000);
const T3 = task("T3", 3000);
const T4 = task("T4", 4000);
// Unsorted on purpose: the helper orders the lane by position itself.
const LANE = [T3, T1, T4, T2];

describe("dropNeighbours", () => {
  it("drops a card dragged down onto T3 below T3, as the preview shows", () => {
    expect(dropNeighbours(LANE, T1, T3)).toEqual({ beforeId: "T3", afterId: "T4" });
  });

  it("moves a card dragged one slot down onto the next card", () => {
    expect(dropNeighbours(LANE, T1, T2)).toEqual({ beforeId: "T2", afterId: "T3" });
  });

  it("drops a card dragged down onto the last card at the bottom of the lane", () => {
    expect(dropNeighbours(LANE, T2, T4)).toEqual({ beforeId: "T4", afterId: undefined });
  });

  it("drops a card dragged up above the over-card", () => {
    expect(dropNeighbours(LANE, T4, T2)).toEqual({ beforeId: "T1", afterId: "T2" });
    expect(dropNeighbours(LANE, T3, T1)).toEqual({ beforeId: undefined, afterId: "T1" });
  });

  it("drops a card from another lane above the over-card", () => {
    const fromBacklog = task("B1", 500, "backlog");
    expect(dropNeighbours(LANE, fromBacklog, T3)).toEqual({ beforeId: "T2", afterId: "T3" });
    expect(dropNeighbours(LANE, fromBacklog, T1)).toEqual({ beforeId: undefined, afterId: "T1" });
  });
});
