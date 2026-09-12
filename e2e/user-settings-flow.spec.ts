/**
 * user-settings-flow.spec.ts — Settings tab navigation + the profile form.
 *
 * Scenario:
 *   1. Log in as admin → /en/settings
 *   2. Assert the default Profile tab renders, with the admin's address in a
 *      read-only email field
 *   3. Click through every tab an ordinary caller is offered — Profile,
 *      Company, Notifications — asserting each renders
 *   4. Assert the app-version footer, which replaced the former "About" tab
 *   5. Type into the display-name field and assert it takes the edit
 *
 * Scope notes:
 *   - Company CRUD is covered by companies-flow.spec.ts. This spec only opens
 *     the "Company" tab to confirm the section renders; it does not create,
 *     edit, or delete a company. That tab carries the caller's attachments
 *     and, for a company admin, the join code / members / directory /
 *     payment methods.
 *   - "Users & Roles" is platform-ops only and the admin persona is not ops,
 *     so it is asserted ABSENT here rather than clicked.
 *   - Nothing is submitted. The profile form has a real Save button wired to
 *     PATCH /auth/me, so saving would leave global drift across runs.
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

  test("navigate the tabs and edit the display name", async ({
    page,
  }: {
    page: Page;
  }) => {
    // ── 1. Navigate ───────────────────────────────────────────────────────────
    await loginAsAdmin(page);
    await page.goto("/en/settings");

    // ── 2. Default Profile tab renders ────────────────────────────────────────
    // Email is read-only on purpose: only an administrator may change it while
    // phone-only sign-in is the rule (see ProfileForm).
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(emailInput).toHaveValue(ADMIN.email, { timeout: 5_000 });
    await expect(emailInput).toHaveAttribute("readonly", "", { timeout: 5_000 });

    // ── 3. Click through the tabs an ordinary caller is offered ───────────────
    // Tabs are <button> elements in the settings nav. Scope clicks to that nav:
    // labels like "Notifications" also appear elsewhere (the topbar bell), so
    // target the nav that holds the "Profile" tab to disambiguate.
    const tabNav = page.locator("nav").filter({
      has: page.getByRole("button", { name: "Profile", exact: true }),
    });

    // The retired placeholder tabs must not come back, and Users & Roles is
    // offered to platform ops only — the admin persona is not ops.
    for (const gone of ["Team", "Billing", "About", "Users & Roles"]) {
      await expect(
        tabNav.getByRole("button", { name: gone, exact: true })
      ).toHaveCount(0);
    }

    // Company — section renders (CRUD itself is covered by companies-flow).
    await tabNav.getByRole("button", { name: "Company", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Company", exact: true })
    ).toBeVisible({ timeout: 8_000 });
    // The attachment half is what every role sees — the admin's own company
    // card, carrying the detach action.
    await expect(
      page.getByRole("button", { name: "Detach" }).first()
    ).toBeVisible({ timeout: 8_000 });

    // Notifications — per-kind preferences, not a placeholder.
    await tabNav
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true })
    ).toBeVisible({ timeout: 8_000 });

    // ── 4. The version footer replaced the "About" tab ────────────────────────
    // It sits under the content column, so it shows whichever tab is open.
    await expect(page.getByText(/^Folio v\d+\.\d+\.\d+/)).toBeVisible({
      timeout: 5_000,
    });

    // ── 5. Edit a profile field (nothing is submitted) ────────────────────────
    await tabNav.getByRole("button", { name: "Profile", exact: true }).click();
    const displayName = page.locator("#profile-display-name");
    await expect(displayName).toBeVisible({ timeout: 5_000 });
    const original = await displayName.inputValue();

    await displayName.fill("E2E probe name");
    await expect(displayName).toHaveValue("E2E probe name", { timeout: 5_000 });

    // Restore the field without saving, so a later manual Save in the same
    // session cannot persist the probe value.
    await displayName.fill(original);
  });
});
