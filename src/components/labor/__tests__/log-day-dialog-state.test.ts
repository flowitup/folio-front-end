/**
 * Tests for the pure helpers backing LogDayDialog (Phase 3e).
 *
 * These cover the partitioning, locking, template-apply, and payload-
 * build logic in isolation — fast, deterministic, no DOM.
 */

import { describe, it, expect } from "vitest";
import {
  applyLastDayTemplate,
  buildBulkPayload,
  buildTileStates,
  partitionWorkers,
  recentWorkerSet,
} from "../log-day-dialog-state";
import type { LaborEntry, Worker } from "@/types/labor";

function worker(id: string, name: string, opts: Partial<Worker> = {}): Worker {
  return {
    id,
    project_id: "p1",
    name,
    phone: null,
    daily_rate: 100,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...opts,
  };
}

function entry(workerId: string, date: string, opts: Partial<LaborEntry> = {}): LaborEntry {
  return {
    id: `${workerId}-${date}`,
    worker_id: workerId,
    worker_name: workerId,
    date,
    amount_override: null,
    effective_cost: 100,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: `${date}T00:00:00Z`,
    ...opts,
  };
}

describe("buildTileStates", () => {
  it("locks workers already logged on the date", () => {
    const states = buildTileStates(
      [worker("w1", "A"), worker("w2", "B")],
      [entry("w1", "2026-05-13")],
      "2026-05-13",
    );
    expect(states.w1).toMatchObject({ checked: true, locked: true });
    expect(states.w2).toMatchObject({ checked: false, locked: false });
  });

  it("ignores entries on other dates", () => {
    const states = buildTileStates(
      [worker("w1", "A")],
      [entry("w1", "2026-05-12")],
      "2026-05-13",
    );
    expect(states.w1.locked).toBe(false);
  });
});

describe("recentWorkerSet", () => {
  it("includes workers with any entry in the last 7 days", () => {
    const today = "2026-05-13";
    const set = recentWorkerSet(
      [
        entry("w1", "2026-05-12"), // within 7d
        entry("w2", "2026-05-01"), // older
      ],
      today,
    );
    expect(set.has("w1")).toBe(true);
    expect(set.has("w2")).toBe(false);
  });

  it("returns empty set for malformed today", () => {
    expect(recentWorkerSet([entry("w1", "2026-05-12")], "bad").size).toBe(0);
  });
});

describe("partitionWorkers", () => {
  const workers = [
    worker("w1", "Alice"),
    worker("w2", "Bob"),
    worker("w3", "Charlie", { is_active: false }),
  ];

  it("splits by recent set + sorts alpha", () => {
    const { recent, rest } = partitionWorkers(workers, new Set(["w2"]), "");
    expect(recent.map((w) => w.name)).toEqual(["Bob"]);
    expect(rest.map((w) => w.name)).toEqual(["Alice"]);
  });

  it("filters by case-insensitive search", () => {
    const { rest } = partitionWorkers(workers, new Set(), "alic");
    expect(rest.map((w) => w.name)).toEqual(["Alice"]);
  });

  it("excludes inactive workers", () => {
    const { rest } = partitionWorkers(workers, new Set(), "");
    expect(rest.map((w) => w.id)).not.toContain("w3");
  });
});

describe("applyLastDayTemplate", () => {
  it("checks matching unlocked tiles + applies shift_type", () => {
    const prev = buildTileStates(
      [worker("w1", "A"), worker("w2", "B")],
      [],
      "2026-05-13",
    );
    const next = applyLastDayTemplate(prev, [
      { worker_id: "w1", shift_type: "half", supplement_hours: 0 },
    ]);
    expect(next.w1).toMatchObject({ checked: true, shift_type: "half" });
    expect(next.w2.checked).toBe(false);
  });

  it("leaves locked tiles alone", () => {
    const prev = buildTileStates(
      [worker("w1", "A")],
      [entry("w1", "2026-05-13", { shift_type: "full" })],
      "2026-05-13",
    );
    const next = applyLastDayTemplate(prev, [
      { worker_id: "w1", shift_type: "half", supplement_hours: 0 },
    ]);
    expect(next.w1.shift_type).toBe("full"); // unchanged
  });
});

describe("buildBulkPayload", () => {
  it("emits only checked, unlocked tiles", () => {
    const states = buildTileStates([worker("w1", "A"), worker("w2", "B")], [], "2026-05-13");
    states.w1.checked = true;
    states.w2.checked = true;
    states.w2.locked = true;
    const payload = buildBulkPayload(states);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ worker_id: "w1", shift_type: "full" });
  });

  it("includes optional fields when set", () => {
    const states = buildTileStates([worker("w1", "A")], [], "2026-05-13");
    states.w1.checked = true;
    states.w1.amount_override = 150;
    states.w1.supplement_hours = 3;
    states.w1.note = "  noted  ";
    const [p] = buildBulkPayload(states);
    expect(p).toMatchObject({
      amount_override: 150,
      supplement_hours: 3,
      note: "noted",
    });
  });

  it("omits zero supplement + blank note", () => {
    const states = buildTileStates([worker("w1", "A")], [], "2026-05-13");
    states.w1.checked = true;
    states.w1.supplement_hours = 0;
    states.w1.note = "   ";
    const [p] = buildBulkPayload(states);
    expect(p.supplement_hours).toBeUndefined();
    expect(p.note).toBeUndefined();
  });

  it("does not include tag_id when not set on tile state (bulk tag applied by caller)", () => {
    // buildBulkPayload does NOT inject tag_id — that responsibility sits
    // in LogDayDialog.doSave which maps over the result and adds bulkTag.
    const states = buildTileStates([worker("w1", "A")], [], "2026-05-13");
    states.w1.checked = true;
    const [p] = buildBulkPayload(states);
    // tag_id is not in the tile state interface, so it must be absent here.
    expect("tag_id" in p).toBe(false);
  });

  it("bulk tag stamping: map over payload adds tag_id to all entries", () => {
    // Simulate what LogDayDialog.doSave does: apply bulkTag after buildBulkPayload.
    const states = buildTileStates(
      [worker("w1", "A"), worker("w2", "B")],
      [],
      "2026-05-13",
    );
    states.w1.checked = true;
    states.w2.checked = true;
    const baseEntries = buildBulkPayload(states);
    const bulkTag = "tag-uuid-123";
    const payload = bulkTag
      ? baseEntries.map((e) => ({ ...e, tag_id: bulkTag }))
      : baseEntries;
    expect(payload).toHaveLength(2);
    expect(payload[0].tag_id).toBe("tag-uuid-123");
    expect(payload[1].tag_id).toBe("tag-uuid-123");
  });

  it("bulk tag omitted: payload has no tag_id when bulkTag is null", () => {
    const states = buildTileStates([worker("w1", "A")], [], "2026-05-13");
    states.w1.checked = true;
    const baseEntries = buildBulkPayload(states);
    const bulkTag = null;
    const payload = bulkTag
      ? baseEntries.map((e) => ({ ...e, tag_id: bulkTag }))
      : baseEntries;
    expect(payload).toHaveLength(1);
    expect("tag_id" in payload[0]).toBe(false);
  });
});
