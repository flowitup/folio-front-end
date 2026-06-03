/**
 * E2E: Project Tags (phase tags) happy-path flow.
 *
 * Scenario:
 *   1. Login as admin → open seeded "Downtown Office Tower" project
 *   2. Go to /en/projects/{id}/tags
 *   3. Add tag "E2E-Tag-{ts}" via the create dialog → assert it appears + toast
 *   4. Rename it via the row "Edit" button → assert the updated name appears
 *   5. Delete it via the row "Delete" button (confirm) → assert it is removed
 *
 * Env flag: TEST_E2E_TAGS
 *
 * Run locally:
 *   TEST_E2E_TAGS=1 npx playwright test e2e/project-tags-flow.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_TAGS);

test.describe("Project tags happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_TAGS=1 to run locally");

  test("create → rename → delete a phase tag", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    await page.goto(`/en/projects/${pid}/tags`);
    await page.waitForLoadState("networkidle");

    // Manager header (tags.manager.title = "Manage tags").
    await expect(page.getByRole("heading", { name: "Manage tags" })).toBeVisible({
      timeout: 15_000,
    });

    const tagName = `E2E-Tag-${Date.now()}`;
    const renamed = `${tagName}-renamed`;

    // ── Create ──────────────────────────────────────────────────────────────
    // Both header ("Add tag") and empty-state ("Create first tag") buttons open
    // the create dialog. Header button is always present.
    await page.getByRole("button", { name: "Add tag" }).click();

    const dialog = page.getByRole("dialog");
    // tags.form.createTitle = "New tag".
    await expect(dialog.getByText("New tag")).toBeVisible({ timeout: 10_000 });

    // tags.form.name = "Name".
    await dialog.getByLabel("Name").fill(tagName);
    // tags.form.save = "Save".
    await dialog.getByRole("button", { name: "Save" }).click();

    // Toast (tags.toast.created = "Tag created") + dialog closes.
    await expect(page.getByText("Tag created")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Tag row renders with the name. The name also appears in the cost-summary
    // table below, so match the first occurrence (the manager list row).
    await expect(page.getByText(tagName, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // ── Rename (edit) ───────────────────────────────────────────────────────
    // TagRow edit button has aria-label "Edit". Scope to the manager-list row
    // that has the tag name AND an Edit button (the summary table also lists the
    // name but has no actions).
    const row = page
      .locator("div.flex.items-center")
      .filter({ hasText: tagName })
      .filter({ has: page.getByRole("button", { name: "Edit" }) })
      .first();
    await row.getByRole("button", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog");
    // tags.form.editTitle = "Edit tag".
    await expect(editDialog.getByText("Edit tag")).toBeVisible({ timeout: 10_000 });

    const nameInput = editDialog.getByLabel("Name");
    await nameInput.fill(renamed);
    await editDialog.getByRole("button", { name: "Save" }).click();

    // Toast (tags.toast.updated = "Tag updated") + updated name visible.
    await expect(page.getByText("Tag updated")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // ── Delete (confirm) ────────────────────────────────────────────────────
    const renamedRow = page
      .locator("div.flex.items-center")
      .filter({ hasText: renamed })
      .filter({ has: page.getByRole("button", { name: "Delete" }) })
      .first();
    await renamedRow.getByRole("button", { name: "Delete" }).click();

    // Confirm AlertDialog (tags.delete.title = "Delete tag?").
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Delete tag?")).toBeVisible({ timeout: 10_000 });
    // tags.delete.confirm = "Delete".
    await confirm.getByRole("button", { name: "Delete" }).click();

    // Toast (tags.toast.deleted = "Tag deleted") + row removed.
    await expect(page.getByText("Tag deleted")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(renamed, { exact: true })).toBeHidden({
      timeout: 10_000,
    });
  });
});
