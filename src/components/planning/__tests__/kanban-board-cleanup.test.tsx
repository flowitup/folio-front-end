/**
 * Regression test: Kanban board view-switcher scope.
 *
 * History: a half-built Board/List/Calendar segmented switcher + a dead
 * Filter button were removed because none of those views existed. The
 * planning surface now ships a REAL Board|Week toggle (week view groups
 * tasks by due_date). This test pins two things:
 *   1. The functional Board|Week toggle is wired (uses the `view.*` keys).
 *   2. The never-implemented List/Calendar/Filter UI stays gone.
 *
 * Source-level assertion is the cheapest way to pin this — fully rendering
 * the KanbanBoard pulls in @dnd-kit, the BacklogBar, KanbanColumn, etc.
 * and the surface area for flake is large.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const KANBAN_SRC = readFileSync(
  resolve(__dirname, "..", "kanban-board.tsx"),
  "utf-8",
);

describe("KanbanBoard — view switcher", () => {
  it("wires the functional Board|Week toggle via the view.* i18n keys", () => {
    expect(KANBAN_SRC).toContain("view.${v}");
    expect(KANBAN_SRC).toContain('"week"');
    expect(KANBAN_SRC).toContain("setView");
  });

  it("does not reintroduce the never-built list/calendar views", () => {
    expect(KANBAN_SRC).not.toContain('t("list")');
    expect(KANBAN_SRC).not.toContain('t("calendar")');
    expect(KANBAN_SRC).not.toContain('view.list');
    expect(KANBAN_SRC).not.toContain('view.calendar');
  });

  it("does not reintroduce the dead Filter control", () => {
    expect(KANBAN_SRC).not.toMatch(/import\s*{[^}]*\bFilter\b[^}]*}\s*from\s*["']lucide-react["']/);
    expect(KANBAN_SRC).not.toContain('t("filter")');
  });
});

describe("KanbanBoard — drag overlay placement", () => {
  it("portals the drag overlay out of the zoomed/transformed page content", () => {
    // Inside zoom:0.8 and the transformed .fade-up wrapper the fixed-position
    // overlay drifted 130-160px from the pointer.
    expect(KANBAN_SRC).toMatch(/createPortal\(\s*<DragOverlay>/);
    expect(KANBAN_SRC).toContain("document.body");
  });

  it("resolves the drop lane from the pointer", () => {
    expect(KANBAN_SRC).toContain("collisionDetection={pointerFirstCollision}");
  });
});

describe("KanbanBoard — touch drag", () => {
  it("registers a touch sensor so cards can be dragged on touch screens", () => {
    expect(KANBAN_SRC).toContain("useSensor(TouchSensor");
    expect(KANBAN_SRC).not.toContain("useSensor(PointerSensor");
  });
});
