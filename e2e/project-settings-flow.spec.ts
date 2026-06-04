/**
 * E2E: Project Settings happy-path flow.
 *
 * NOTE on field choice: the settings page only exposes ONE editable field —
 * the invoice number prefix (project.invoice_prefix). There is no budget or
 * address field on this route (those live elsewhere / are not editable here).
 * So this spec edits the invoice prefix, which is a NON-NAME field and does
 * NOT touch the project name "Downtown Office Tower" that other specs resolve
 * by name. The spec is self-restoring: it captures the original prefix and
 * writes it back at the end (in a finally block) so re-runs stay clean.
 *
 * Scenario:
 *   1. Login as admin → open seeded "Downtown Office Tower" project
 *   2. Go to /en/projects/{id}/settings
 *   3. Capture the current invoice prefix, set a new unique value, Save
 *   4. Assert success toast (projects.settingsSaved = "Settings saved")
 *   5. Reload → assert the new value persisted
 *   6. Restore the original prefix (self-cleanup)
 *
 * Env flag: TEST_E2E_PROJECT_SETTINGS
 *
 * Run locally:
 *   TEST_E2E_PROJECT_SETTINGS=1 npx playwright test e2e/project-settings-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_PROJECT_SETTINGS);

/** Save the prefix field and wait for the success toast. */
async function setPrefixAndSave(page: Page, value: string): Promise<void> {
  const input = page.locator("#invoice-prefix");
  await input.fill(value);
  // The Save button is disabled until the field is dirty; click once enabled.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 10_000 });
}

test.describe("Project settings happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PROJECT_SETTINGS=1 to run locally");

  test("edit invoice prefix → save → persists after reload", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    await page.goto(`/en/projects/${pid}/settings`);
    await page.waitForLoadState("networkidle");

    // Settings header (projects.settingsTitle = "Project Settings").
    await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
      timeout: 15_000,
    });

    const prefixInput = page.locator("#invoice-prefix");
    await expect(prefixInput).toBeVisible({ timeout: 10_000 });

    // Capture the original value so we can restore it afterwards.
    const original = await prefixInput.inputValue();

    // New value: prefix is uppercase A-Z0-9, max 8 chars. Use a short token
    // derived from the clock so reruns differ from the previous run.
    const newPrefix = `E2E${(Date.now() % 100000).toString().padStart(5, "0")}`.slice(0, 8);

    try {
      // ── Edit + save ───────────────────────────────────────────────────────
      await setPrefixAndSave(page, newPrefix);

      // ── Persisted across a full reload ───────────────────────────────────
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#invoice-prefix")).toHaveValue(newPrefix, {
        timeout: 15_000,
      });
    } finally {
      // ── Self-restore: write the original prefix back ─────────────────────
      // The input rejects characters outside [A-Z0-9]; an empty original is a
      // valid "blank" state but Save is gated on dirtiness + a non-empty
      // server-side prefix. If original was non-empty, restore it directly;
      // otherwise leave the test value (still a valid, non-destructive prefix).
      if (original && original !== newPrefix) {
        await page.goto(`/en/projects/${pid}/settings`);
        await page.waitForLoadState("networkidle");
        await setPrefixAndSave(page, original);
      }
    }
  });
});
