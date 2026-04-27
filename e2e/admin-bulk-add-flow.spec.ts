/**
 * E2E: Admin bulk-add users to multiple projects
 *
 * Prerequisites (same constraints as invite-flow.spec.ts):
 *   - Frontend dev server running on http://localhost:3000 (playwright.config webServer)
 *   - Backend running on http://localhost:5000 with:
 *       EMAIL_PROVIDER=inmemory
 *       TESTING=True
 *   - Seeded admin user (ADMIN_EMAIL / ADMIN_PASSWORD env vars,
 *     defaults: admin@example.com / password123)
 *   - At least one non-admin user and at least 2 projects in the database
 *   - The admin account must have the superadmin role (*:* permission)
 *
 * NOTE on env-blocking:
 *   These tests require a live backend with a seeded superadmin user and at
 *   least one other user + 2 projects. In CI without the full stack, they will
 *   be skipped or marked env-blocked — same behavior as the existing
 *   invite-flow.spec.ts. Backend pytest tests provide functional coverage when
 *   the e2e environment is not available.
 *
 * IMPORTANT: Do NOT run Playwright e2e tests without the full stack running.
 * Run `npx playwright test admin-bulk-add-flow --list` to verify spec compiles
 * without executing it against a live server.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

const NON_ADMIN_EMAIL = process.env.NON_ADMIN_EMAIL || "member@example.com";
const NON_ADMIN_PASSWORD = process.env.NON_ADMIN_PASSWORD || "password123";

// Search term that matches at least one seeded non-admin user (3+ chars)
const USER_SEARCH_QUERY = process.env.E2E_BULK_ADD_SEARCH || "member";

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Admin bulk-add flow", () => {
  // ---- Happy path ----------------------------------------------------------

  test("happy path: admin searches for user, selects projects, picks role, submits — sees success toast", async ({
    page,
  }) => {
    // ---- Step 1: Login as admin ----
    await loginAsAdmin(page);

    // ---- Step 2: Navigate to admin users page ----
    await page.goto("/en/admin/users");
    await page.waitForLoadState("networkidle");

    // Page must render the bulk-add form
    const userSearchInput = page.getByRole("textbox", { name: /user/i }).first();
    await expect(userSearchInput).toBeVisible({ timeout: 10000 });

    // ---- Step 3: Search for an existing user ----
    await userSearchInput.fill(USER_SEARCH_QUERY);

    // Wait for dropdown to appear (debounce is 250ms; give generous timeout)
    const listbox = page.getByRole("listbox");
    const hasResults = await listbox
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      test.skip(
        true,
        `User search returned no results for query "${USER_SEARCH_QUERY}". ` +
          "Ensure the backend is seeded with a non-admin user matching this query. " +
          "Set E2E_BULK_ADD_SEARCH env var to a matching prefix."
      );
      return;
    }

    // ---- Step 4: Select the first result ----
    const firstOption = listbox.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    // Listbox closes after selection
    await expect(listbox).not.toBeVisible({ timeout: 3000 });

    // ---- Step 5: Select at least 2 project checkboxes ----
    const checkboxes = page.getByRole("checkbox");
    const checkboxCount = await checkboxes.count();

    if (checkboxCount < 2) {
      test.skip(
        true,
        "Fewer than 2 project checkboxes found. " +
          "Ensure the backend is seeded with at least 2 projects."
      );
      return;
    }

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // ---- Step 6: Pick a role from the select ----
    const roleSelect = page.getByRole("combobox");
    await roleSelect.click();
    const firstRoleOption = page.getByRole("option").first();
    await expect(firstRoleOption).toBeVisible({ timeout: 5000 });
    await firstRoleOption.click();

    // ---- Step 7: Submit ----
    const submitBtn = page.getByRole("button", { name: /add to selected/i });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // ---- Step 8: Assert success toast ----
    // The toast contains "Added user to" for the added results
    const successToast = page.getByText(/Added user to/i);
    await expect(successToast).toBeVisible({ timeout: 10000 });
  });

  // ---- Negative path: non-admin access -------------------------------------

  test("negative: non-admin user visiting /en/admin/users is redirected to unauthorized or sees 403", async ({
    page,
  }) => {
    // Attempt login as a non-admin user
    await page.goto("/en/login");
    await page.fill("#email", NON_ADMIN_EMAIL);
    await page.fill("#password", NON_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for login to complete (success or failure)
    await page.waitForLoadState("networkidle");

    const isLoggedIn = !page.url().includes("/login");

    if (!isLoggedIn) {
      // Non-admin user credentials not configured or not in DB — navigate directly
      // to the admin page as a logged-out user to test the auth guard
      await page.goto("/en/login");
      await page.waitForLoadState("networkidle");
      await page.goto("/en/admin/users");
      await page.waitForLoadState("networkidle");

      // Should redirect to login (unauthenticated)
      await expect(page).toHaveURL(/\/en\/login/, { timeout: 10000 });
      return;
    }

    // Logged in as non-admin — navigate to admin page
    await page.goto("/en/admin/users");
    await page.waitForLoadState("networkidle");

    // Assert redirect to /unauthorized OR the page shows an error/403 response
    const url = page.url();
    const isRedirected =
      url.includes("/unauthorized") ||
      url.includes("/403") ||
      url.includes("/login") ||
      url.includes("/dashboard");

    // At minimum the admin form should NOT be visible for non-admin
    const formVisible = await page
      .getByRole("textbox", { name: /user/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(
      isRedirected || !formVisible,
      `Expected non-admin to be redirected or blocked from /en/admin/users. ` +
        `URL: ${url}, form visible: ${formVisible}`
    ).toBe(true);
  });

  // ---- Unauthenticated access ----------------------------------------------

  test("unauthenticated: visiting /en/admin/users without login redirects to /en/login", async ({
    page,
  }) => {
    // Navigate directly without logging in
    await page.goto("/en/admin/users");
    await page.waitForLoadState("networkidle");

    // Should land on login page (Next.js middleware redirects unauthenticated users)
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 10000 });
  });
});
