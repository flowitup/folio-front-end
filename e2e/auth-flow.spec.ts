/**
 * E2E: Authentication happy-path + error flow.
 *
 * Scenarios:
 *   1. Bad credentials → inline "Invalid credentials" error, URL stays on /login.
 *   2. Valid admin login → lands on /dashboard (or /projects).
 *   3. Logout → user menu (avatar) → "Sign out" → redirect back to /en/login;
 *      visiting a protected route then bounces to login.
 *
 * Selectors confirmed from source:
 *   - #email / #password inputs + getByRole("button", { name: "Sign in" })
 *       → src/components/auth/LoginForm.tsx:55,73,88-101
 *   - Bad-cred error text "Invalid credentials" (auth.errorInvalid)
 *       → src/messages/en.json:36 (rendered LoginForm.tsx:47)
 *   - User menu trigger = avatar button title={user.email}; "Sign out" item
 *       (common.signOut) → src/components/layout/Topbar.tsx:241-262, en.json:5
 *   - logout server action redirect("/login") → src/lib/auth/actions.ts:111
 *
 * CI skip: requires a running backend (Docker stack) with seeded data.
 * Skipped unless TEST_E2E_AUTH=1.
 *
 * Run locally:
 *   TEST_E2E_AUTH=1 npx playwright test e2e/auth-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { ADMIN } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_AUTH);

test.describe("Auth flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_AUTH=1 to run locally");

  test("login with bad credentials shows error", async ({ page }: { page: Page }) => {
    await page.goto("/en/login");

    await page.waitForSelector("#email", { timeout: 10_000 });
    await page.fill("#email", ADMIN.email);
    await page.fill("#password", "definitely-wrong-password");

    await page.getByRole("button", { name: "Sign in" }).click();

    // Inline error block renders the backend message ("Invalid email or
    // password") or, if absent, the i18n fallback auth.errorInvalid
    // ("Invalid credentials"). Match either — both mean auth was rejected.
    await expect(
      page.getByText(/invalid email or password|invalid credentials/i)
    ).toBeVisible({ timeout: 10_000 });

    // Still on the login route — no redirect occurred.
    await expect(page).toHaveURL(/\/login/);
  });

  test("login succeeds and lands on app", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/(en|fr|vi)\/(dashboard|projects)/, { timeout: 15_000 });
  });

  test("logout returns to login", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    // Open the user menu (avatar button carries the user's email as its title).
    await page.locator(`button[title="${ADMIN.email}"]`).click();

    // Click the "Sign out" item (common.signOut).
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // logoutAction clears cookies and redirects to /login (locale-prefixed).
    await page.waitForURL(/\/(en|fr|vi)?\/?login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);

    // Protected route now bounces back to login (middleware guard).
    await page.goto("/en/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
