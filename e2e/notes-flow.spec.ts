/**
 * E2E: Notes flow
 *
 * Scenario:
 *   1. Login as test user
 *   2. Navigate to a project's notes page
 *   3. Add a new note (today, lead_time 0)
 *   4. Mark the note as done
 *   5. Wait for bell badge to reflect 0 (no due notifications)
 *   6. Click bell → assert empty state in dropdown
 *
 * NOTE: This test is env-blocked at runtime (requires TEST_EMAIL, TEST_PASSWORD,
 * TEST_PROJECT_ID env vars). It will be skipped automatically in CI without them.
 * The file is structurally correct — Playwright can parse and compile it.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID ?? "";

// Skip the entire suite if env vars are not set (CI without test credentials)
test.skip(
  !TEST_EMAIL || !TEST_PASSWORD || !TEST_PROJECT_ID,
  "E2E notes flow skipped: TEST_EMAIL / TEST_PASSWORD / TEST_PROJECT_ID not set"
);

test.describe("Notes flow", () => {
  test("add note → mark done → bell badge disappears → empty state in dropdown", async ({
    page,
  }) => {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/en/login`);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(en|fr|vi)\/(dashboard|projects)/, { timeout: 15_000 });

    // ── 2. Navigate to project notes ──────────────────────────────────────────
    await page.goto(`${BASE_URL}/en/projects/${TEST_PROJECT_ID}/notes`);
    await page.waitForLoadState("networkidle");

    // ── 3. Add a new note (today, lead_time 0) ────────────────────────────────
    await page.getByRole("button", { name: /add note/i }).click();

    const titleInput = page.getByPlaceholder(/note title|title/i);
    await titleInput.fill("E2E test note — can delete");

    // Submit with Enter
    await titleInput.press("Enter");

    // Wait for the note to appear in the list
    await expect(page.getByText("E2E test note — can delete")).toBeVisible({
      timeout: 10_000,
    });

    // ── 4. Mark the note as done ──────────────────────────────────────────────
    const checkbox = page
      .getByRole("row")
      .filter({ hasText: "E2E test note — can delete" })
      .getByRole("checkbox");

    await checkbox.click();

    // Note should move to "Done" bucket
    await expect(
      page.locator("section", { hasText: /done/i }).getByText("E2E test note — can delete")
    ).toBeVisible({ timeout: 10_000 });

    // ── 5. Bell badge should show 0 (note is now done, not due) ───────────────
    // Poll gives up to 90s for the next fetch cycle to run
    const bellBadge = page.locator("button[aria-label*='bell'] span");
    await expect(bellBadge).not.toBeVisible({ timeout: 90_000 });

    // ── 6. Click bell → empty state in dropdown ───────────────────────────────
    await page.getByRole("button", { name: /bell|notifications/i }).click();

    // The dropdown empty state text (from i18n key notifications.empty)
    await expect(page.getByText(/no notifications|all caught up/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
