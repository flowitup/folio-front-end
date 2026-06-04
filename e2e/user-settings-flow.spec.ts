/**
 * user-settings-flow.spec.ts — User settings tab-navigation + profile E2E.
 *
 * Scenario:
 *   1. Log in as admin → /en/settings
 *   2. Assert the default Profile tab renders (email field visible)
 *   3. Click through the visible tabs (Profile, My companies, Notifications,
 *      About) asserting each section renders
 *   4. Edit the Profile email field and assert the input accepts the change
 *
 * Scope note:
 *   Company CRUD is covered by companies-flow.spec.ts — this spec only touches
 *   the "My companies" tab to confirm the section renders; it does NOT create,
 *   edit, or delete a company.
 *
 * IMPORTANT — Profile tab has no Save/toast in this build:
 *   The Profile section (settings-client.tsx) renders two UNCONTROLLED inputs
 *   (email + phone via `defaultValue`) with NO Save button and NO save action,
 *   so there is no success toast to assert and no global mutation to restore.
 *   We therefore assert the field is editable rather than a non-existent toast.
 *   If a Save button + toast is added later, extend step 4 accordingly.
 *
 * CI skip:
 *   Set TEST_E2E_USER_SETTINGS=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts and companies-flow.spec.ts.
 *
 * Run locally:
 *   TEST_E2E_USER_SETTINGS=1 npx playwright test e2e/user-settings-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { ADMIN } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_USER_SETTINGS);

test.describe("User settings tab-navigation + profile flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_USER_SETTINGS=1 to run locally");

  test("navigate tabs and edit the profile email field", async ({
    page,
  }: {
    page: Page;
  }) => {
    // ── 1. Navigate ───────────────────────────────────────────────────────────
    await loginAsAdmin(page);
    await page.goto("/en/settings");

    // ── 2. Default Profile tab renders ────────────────────────────────────────
    // Profile section shows the admin email as a heading + an editable email
    // input pre-filled with the admin's address.
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(emailInput).toHaveValue(ADMIN.email, { timeout: 5_000 });

    // ── 3. Click through visible tabs ─────────────────────────────────────────
    // Tabs are <button> elements in the settings nav. Labels come from i18n
    // (settings.<key>): "Profile", "My companies", "Notifications", "About".
    // ("Users & Roles" is admin-only and "Team"/"Billing" are coming-soon
    // placeholders — we cover the four called out in the task.)

    // Scope tab clicks to the settings <nav> — labels like "Notifications" also
    // appear elsewhere (e.g. the topbar bell), so target the nav that holds the
    // "Profile" tab to disambiguate.
    const tabNav = page.locator("nav").filter({
      has: page.getByRole("button", { name: "Profile", exact: true }),
    });

    // My companies — section renders (CRUD itself is covered by companies-flow).
    // settings.myCompanies.title = "My companies".
    await tabNav.getByRole("button", { name: "My companies", exact: true }).click();
    // MyCompaniesSection heading repeats the tab label.
    await expect(
      page.getByRole("heading", { name: "My companies" })
    ).toBeVisible({ timeout: 8_000 });

    // Notifications — coming-soon placeholder. settings.notifications =
    // "Notifications"; settings.comingSoon = "will be available soon".
    await tabNav.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByText("will be available soon")).toBeVisible({
      timeout: 8_000,
    });

    // About — shows app version row. settings.about = "About",
    // settings.version = "Version".
    await tabNav.getByRole("button", { name: "About", exact: true }).click();
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText("Version")).toBeVisible({ timeout: 5_000 });
    // Version value is rendered as `v<semver>` from package.json.
    await expect(page.getByText(/^v\d+\.\d+\.\d+/).first()).toBeVisible({ timeout: 5_000 });

    // Back to Profile.
    await tabNav.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    // ── 4. Edit a profile field (no Save/toast exists — assert editability) ────
    // The email input is uncontrolled (defaultValue); typing into it should
    // update its value. There is no Save action to click, so we stop here.
    // Use a benign edit that never persists (no submit), so admin state is
    // untouched across runs.
    const probeValue = "admin+e2e-probe@example.com";
    await emailInput.fill(probeValue);
    await expect(emailInput).toHaveValue(probeValue, { timeout: 5_000 });
    // TODO(verify): if a "Save" button + success toast is added to the Profile
    // tab, replace the editability assertion above with: click Save → assert
    // toast → restore the original email (ADMIN.email) to avoid global drift.
  });
});
