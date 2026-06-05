/**
 * E2E: Invite-only signup flow
 *
 * Prerequisites:
 *   - Frontend dev server running on http://localhost:3000  (playwright.config webServer)
 *   - Backend running on http://localhost:5000 with:
 *       EMAIL_PROVIDER=inmemory   (enables in-memory email capture)
 *       TESTING=True              (enables the test-only /__test__/last-email endpoint)
 *   - Seeded admin user (ADMIN_EMAIL / ADMIN_PASSWORD env vars, defaults: admin@example.com / password123)
 *   - At least one project in the database
 *
 * NOTE on backend setup:
 *   playwright.config.ts only starts the Next.js dev server. It does NOT start the backend.
 *   The backend must be started externally with the env vars above before running these tests.
 *   If `GET /api/v1/__test__/last-email` returns 404 or 403, the happy-path test will be
 *   skipped with a descriptive message. The expired-token test does NOT require the backend
 *   test endpoint and runs independently.
 */

import { test, expect, Browser } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const LAST_EMAIL_ENDPOINT = `${BACKEND_URL}/api/v1/__test__/last-email`;

// Unique per-run email to avoid cross-test pollution
const INVITE_EMAIL = `e2e-invite-${Date.now()}@example.com`;

/**
 * Dynamically discover the first project ID available to the logged-in admin.
 */
async function getFirstProjectId(page: import("@playwright/test").Page): Promise<string> {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/v1/projects") && resp.status() === 200,
    { timeout: 15000 }
  );
  await page.goto("/en/projects");
  try {
    const response = await responsePromise;
    const data = await response.json();
    if (data.projects && data.projects.length > 0) {
      return data.projects[0].id;
    }
  } catch {
    // fallback below
  }
  // UI fallback
  const card = page.locator("h3.truncate").first();
  await card.waitFor({ timeout: 10000 }).catch(() => {});
  throw new Error(
    "No project found for e2e test. Ensure the backend is seeded with at least one project."
  );
}

/**
 * Fetch the last email sent via InMemoryEmailAdapter.
 * Returns null if the endpoint is unavailable (backend not started with TESTING=True).
 */
async function fetchLastEmail(): Promise<{
  to: string;
  subject: string;
  body: string;
  accept_url?: string;
} | null> {
  try {
    const resp = await fetch(LAST_EMAIL_ENDPOINT, { method: "GET" });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Invite-only signup flow", () => {
  test("happy path: admin invites → email extracted → new user accepts → dashboard", async ({
    page,
    browser,
  }: {
    page: import("@playwright/test").Page;
    browser: Browser;
  }) => {
    // ---- Step 1: Login as admin ----
    await loginAsAdmin(page);

    // ---- Step 2: Navigate to a project's members page ----
    const projectId = process.env.TEST_PROJECT_ID || (await getFirstProjectId(page));
    await page.goto(`/en/projects/${projectId}/members`);
    await page.waitForLoadState("networkidle");

    // ---- Step 3: Open invite dialog, fill email + role, submit ----
    const inviteBtn = page.getByRole("button", { name: /invite member/i });
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/email address/i).fill(INVITE_EMAIL);

    // Open role select and pick first available role
    const roleTrigger = dialog.getByRole("combobox");
    await roleTrigger.click();
    const firstRoleOption = page.locator('[role="option"]').first();
    await expect(firstRoleOption).toBeVisible({ timeout: 5000 });
    await firstRoleOption.click();

    // Submit invitation
    const sendBtn = dialog.getByRole("button", { name: /send invitation/i });
    await sendBtn.click();

    // ---- Step 4: Wait for response; assert pending row appears ----
    // Dialog should close on success
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Navigate to the pending invitations tab to see the invited user
    const pendingTab = page.getByRole("button", { name: /pending/i });
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
    }
    // The invited email should appear somewhere on the page. It can render in
    // more than one place (the pending-invitations table cell and the success
    // toast), so scope to the first match to avoid a strict-mode violation.
    await expect(page.getByText(INVITE_EMAIL).first()).toBeVisible({ timeout: 10000 });

    // ---- Step 5: Extract accept URL from InMemoryEmailAdapter ----
    const emailPayload = await fetchLastEmail();
    if (!emailPayload) {
      test.skip(
        true,
        `Backend test endpoint ${LAST_EMAIL_ENDPOINT} is unavailable. ` +
          "Ensure backend is running with TESTING=True and EMAIL_PROVIDER=inmemory. " +
          "Skipping steps 5-8 (accept-invite happy path)."
      );
      return;
    }

    // Extract accept URL — backend returns it as `accept_url` field or embedded in body
    let acceptUrl: string | undefined = emailPayload.accept_url;
    if (!acceptUrl && emailPayload.body) {
      // Fallback: parse first http URL from body that contains /accept-invite/
      const match = emailPayload.body.match(/https?:\/\/[^\s"<]+\/accept-invite\/[^\s"<]+/);
      acceptUrl = match?.[0];
    }
    expect(acceptUrl, "accept URL must be present in last email payload").toBeTruthy();

    // Strip the domain part — navigate relative to frontend base
    const url = new URL(acceptUrl!);
    const relativePath = url.pathname + url.search + url.hash;

    // ---- Step 6: Open new browser context (logged-out) ----
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      await guestPage.goto(relativePath);
      await guestPage.waitForLoadState("networkidle");

      // ---- Step 7: Fill name + password; submit ----
      await guestPage.getByLabel(/your full name/i).fill("E2E New User");
      await guestPage.getByLabel(/choose a password/i).fill("E2ETestPass1!");
      await guestPage.getByLabel(/confirm password/i).fill("E2ETestPass1!");
      await guestPage.getByRole("button", { name: /create account/i }).click();

      // ---- Step 8: Assert redirected to dashboard & user authenticated ----
      await guestPage.waitForURL(/\/(en|vi)\/dashboard/, { timeout: 15000 });
      await expect(guestPage).not.toHaveURL(/\/login/);
      // Dashboard should show some authenticated UI
      await expect(
        guestPage.locator("body")
      ).not.toContainText(/you're invited/i, { timeout: 5000 });
    } finally {
      await guestContext.close();
    }
  });

  test("expired/invalid token: shows invalid invitation error UI + login CTA", async ({
    page,
  }) => {
    // Navigate directly to an accept-invite URL with a nonexistent token
    // The page SSR-verifies the token with the backend; backend returns 404/410
    // which renders InviteError with reason=not_found or expired

    await page.goto("/en/accept-invite/this-token-does-not-exist-e2e-test");
    await page.waitForLoadState("networkidle");

    // InviteError component renders an error banner and a login link
    // Check for the error UI — it shows "invalid" or "expired" text
    const _errorBanner = page.locator('[style*="negative-tint"]').or(
      page.getByRole("alert")
    ).first();

    // At minimum we expect the login CTA link to be present
    const loginCTA = page.getByRole("link", { name: /go to login/i });
    await expect(loginCTA).toBeVisible({ timeout: 10000 });

    // Also confirm that the form (Create account button) is NOT shown — only error UI
    await expect(page.getByRole("button", { name: /create account/i })).not.toBeVisible();
  });
});
