/**
 * E2E: Project Planning (Kanban) happy-path flow.
 *
 * DnD mechanism found: the board uses @dnd-kit/core (PointerSensor +
 * KeyboardSensor) for drag-and-drop between columns. Pointer-based dnd-kit
 * drags are notoriously flaky under Playwright (activation distance, drag
 * overlay, optimistic-then-refetch). To prove a durable task state change
 * without flake, this spec exercises the LESS-flaky CREATE path instead:
 *   - Each KanbanColumn header renders a "+" button (aria-label "Add task")
 *     that opens <TaskCreateDialog> seeded with that column's status.
 *   - We create a task in the "To do" lane, assert it renders in that lane,
 *     then page.reload() and assert it persisted (proves the server accepted
 *     the create with status=todo).
 *
 * Scenario:
 *   1. Login as admin → open seeded "Downtown Office Tower" project
 *   2. Go to /en/projects/{id}/planning → assert kanban columns render
 *   3. Click the "To do" column "+" → fill the create form → Save
 *   4. Assert the new task card renders in the "To do" column
 *   5. page.reload() → assert the task still renders (persisted)
 *
 * Env flag: TEST_E2E_PLANNING
 *
 * Run locally:
 *   TEST_E2E_PLANNING=1 npx playwright test e2e/project-planning-flow.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_PLANNING);

test.describe("Project planning kanban happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PLANNING=1 to run locally");

  test("create task in To do lane → persists after reload", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    await page.goto(`/en/projects/${pid}/planning`);
    await page.waitForLoadState("networkidle");

    // ── Kanban columns render ───────────────────────────────────────────────
    // BOARD_COLUMNS = ["todo","in_progress","blocked","done"] → headings
    // "To do" / "In progress" / "Blocked" / "Done" (planning.column.*).
    const todoHeading = page.getByRole("heading", { name: "To do" });
    await expect(todoHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "In progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Blocked" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

    const taskTitle = `E2E-Task-${Date.now()}`;

    // ── Open the create dialog from the "To do" lane "+" button ──────────────
    // The column's header div contains the <h3> title and the add button
    // (aria-label "Add task"). Scope to that lane to seed status=todo.
    const todoLane = page
      .locator("div.lane")
      .filter({ has: page.getByRole("heading", { name: "To do" }) });
    await todoLane.getByRole("button", { name: "Add task" }).click();

    // TaskCreateDialog title = planning.newTask ("New task").
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("New task")).toBeVisible({ timeout: 10_000 });

    // Fill the title (planning.titleLabel = "Title") and submit.
    await dialog.getByLabel("Title").fill(taskTitle);
    await dialog.getByRole("button", { name: "Save" }).click();

    // Dialog closes after a successful create.
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // ── New card renders in the "To do" lane ────────────────────────────────
    await expect(todoLane.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });

    // ── Persisted across a full reload ──────────────────────────────────────
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "To do" })).toBeVisible({
      timeout: 15_000,
    });

    const todoLaneAfter = page
      .locator("div.lane")
      .filter({ has: page.getByRole("heading", { name: "To do" }) });
    await expect(todoLaneAfter.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });
  });
});
