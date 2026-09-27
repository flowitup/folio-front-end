/**
 * reorder.test.ts
 *
 * The reorder endpoints place an item between the neighbour above
 * (`before_id`) and the neighbour below (`after_id`) its new slot. These pin
 * that the payload is read off the list as it will be after the move — reading
 * it off the old list would send a room moved up straight back where it was.
 */

import { describe, it, expect } from "vitest";

import { neighboursAfterMove, planMove } from "../reorder";

const ROOMS = [
  { id: "a", name: "Salon" },
  { id: "b", name: "Cuisine" },
  { id: "c", name: "Chambre" },
  { id: "d", name: "Garage" },
];

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("planMove", () => {
  it("moves an item up one slot, between the two rooms above it", () => {
    const plan = planMove(ROOMS, "c", "b");
    expect(ids(plan!.items)).toEqual(["a", "c", "b", "d"]);
    expect(plan!.move).toEqual({ before_id: "a", after_id: "b" });
  });

  it("moves an item down one slot, between the two rooms below it", () => {
    const plan = planMove(ROOMS, "b", "c");
    expect(ids(plan!.items)).toEqual(["a", "c", "b", "d"]);
    expect(plan!.move).toEqual({ before_id: "c", after_id: "d" });
  });

  it("has no neighbour above when an item becomes the first", () => {
    const plan = planMove(ROOMS, "b", "a");
    expect(ids(plan!.items)).toEqual(["b", "a", "c", "d"]);
    expect(plan!.move).toEqual({ before_id: null, after_id: "a" });
  });

  it("has no neighbour below when an item becomes the last", () => {
    const plan = planMove(ROOMS, "c", "d");
    expect(ids(plan!.items)).toEqual(["a", "b", "d", "c"]);
    expect(plan!.move).toEqual({ before_id: "d", after_id: null });
  });

  it("handles a drag across several slots", () => {
    const plan = planMove(ROOMS, "a", "d");
    expect(ids(plan!.items)).toEqual(["b", "c", "d", "a"]);
    expect(plan!.move).toEqual({ before_id: "d", after_id: null });
  });

  it("does not touch the list it was given", () => {
    planMove(ROOMS, "a", "d");
    expect(ids(ROOMS)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns null when nothing would move", () => {
    expect(planMove(ROOMS, "b", "b")).toBeNull();
    expect(planMove(ROOMS, "zz", "b")).toBeNull();
    expect(planMove(ROOMS, "b", "zz")).toBeNull();
  });
});

describe("neighboursAfterMove", () => {
  it("gives the same payload as the planned move", () => {
    expect(neighboursAfterMove(ROOMS, "c", "b")).toEqual({
      before_id: "a",
      after_id: "b",
    });
    expect(neighboursAfterMove(ROOMS, "b", "b")).toBeNull();
  });
});
