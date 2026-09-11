/**
 * E2E: Authentication happy-path + error flow.
 *
 * Sign-in is phone + SMS code; email and password are gone, and the backend
 * has no /auth/login route at all.
 *
 * Scenarios:
 *   1. Wrong code → inline error, URL stays on /login.
 *   2. Valid admin sign-in → lands on /dashboard (or /projects).
 *   3. Logout → user menu (avatar) → "Sign out" → redirect back to /en/login;
 *      visiting a protected route then bounces to login.
 *   4. No email or password field is reachable on the sign-in screen.
 *
 * Selectors confirmed from source:
 *   - #phone / #code inputs → src/components/auth/PhoneLoginForm.tsx
 *   - Wrong-code error (auth.errorInvalidCode) → src/messages/en.json
 *   - User menu trigger = avatar button title={user.email}; "Sign out" item
 *       (common.signOut) → src/components/layout/Topbar.tsx
 *   - logout server action redirect("/login") → src/lib/auth/actions.ts
 *
 * CI skip: requires a running backend (Docker stack) with seeded data, running
 * with FLASK_ENV=development and OTP_TEST_CODE set so the code step can be
 * completed without a real SMS. Skipped unless TEST_E2E_AUTH=1.
 *
 * Run locally:
 *   TEST_E2E_AUTH=1 npx playwright test e2e/auth-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin, enterCode, nationalNumber } from "./helpers/auth-helper";
import { ADMIN } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_AUTH);

test.describe("Auth flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_AUTH=1 to run locally");

  test("sign-in offers no email or password field", async ({ page }: { page: Page }) => {
    await page.goto("/en/login");

    await page.waitForSelector("#phone", { timeout: 10_000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByTestId("login-use-email")).toHaveCount(0);
  });

  test("wrong code shows an error and stays on login", async ({ page }: { page: Page }) => {
    await page.goto("/en/login");

    await page.waitForSelector("#phone", { timeout: 10_000 });
    await page.fill("#phone", nationalNumber(ADMIN.phone));
    await page.getByTestId("login-send-code").click();

    // The row submits itself on the sixth digit — no click needed.
    await enterCode(page, "000000");

    await expect(
      page.getByText(/wrong or expired code/i)
    ).toBeVisible({ timeout: 10_000 });

    // Still on the login route — no redirect occurred.
    await expect(page).toHaveURL(/\/login/);
  });

  test("phone sign-in succeeds and lands on app", async ({ page }: { page: Page }) => {
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
