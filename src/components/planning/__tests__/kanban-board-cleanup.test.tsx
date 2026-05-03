/**
 * Regression test: Kanban board view-switcher + filter cleanup.
 *
 * Asserts the unimplemented Board/List/Calendar segmented tabs and the
 * unimplemented Filter button are gone, so they can't regress as
 * silently-dead UI.
 *
 * Source-level assertion is the cheapest way to pin this — fully rendering
 * the KanbanBoard pulls in @dnd-kit, the BacklogBar, KanbanColumn, etc.
 * and the surface area for flake is large. The buttons being literally
 * absent in the source covers the regression.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const KANBAN_SRC = readFileSync(
  resolve(__dirname, "..", "kanban-board.tsx"),
  "utf-8",
);

describe("KanbanBoard — dead UI removed (source-level)", () => {
  it("does not invoke the board/list/calendar i18n keys", () => {
    expect(KANBAN_SRC).not.toContain('t("board")');
    expect(KANBAN_SRC).not.toContain('t("list")');
    expect(KANBAN_SRC).not.toContain('t("calendar")');
  });

  it("does not import the Filter icon", () => {
    expect(KANBAN_SRC).not.toMatch(/import\s*{[^}]*\bFilter\b[^}]*}\s*from\s*["']lucide-react["']/);
  });

  it("does not invoke the filter i18n key", () => {
    expect(KANBAN_SRC).not.toContain('t("filter")');
  });
});
