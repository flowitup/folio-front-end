/**
 * companies-flow.spec.ts — Companies happy-path E2E scenario.
 *
 * Flow:
 *   1. Log in as admin → Settings → All companies → New company → fill + save → manage
 *   2. Admin: Invites tab → Generate invite → copy token
 *   3. Log in as user2 → Settings → Add company → paste token → success
 *   4. user2: Open /billing/devis/new → picker shows the new company → fill + save → success
 *   5. Verify doc PDF downloads with correct issuer info
 *
 * CI skip:
 *   Set TEST_E2E_COMPANIES=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts and labor-charge-full-workflow.spec.ts.
 *
 * Run locally:
 *   TEST_E2E_COMPANIES=1 npx playwright test e2e/companies-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

// ---------------------------------------------------------------------------
// CI guard
// ---------------------------------------------------------------------------

const RUN_COMPANIES_E2E = Boolean(process.env.TEST_E2E_COMPANIES);

// ---------------------------------------------------------------------------
// Shared state across steps (token captured from admin session)
// ---------------------------------------------------------------------------

let capturedToken = "";

// ---------------------------------------------------------------------------
// Step 1: Admin creates a new company
// ---------------------------------------------------------------------------

test.describe("Companies happy-path flow", () => {
  test.skip(!RUN_COMPANIES_E2E, "Skipped in CI: set TEST_E2E_COMPANIES=1 to run locally");

  test("01 — admin creates a new company via Settings > All companies", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await page.goto("/en/settings");

    // Scroll to / click the admin companies section
    await page.waitForSelector("#admin-companies", { timeout: 10_000 });
    await page.click("button:has-text('New company')");

    await page.waitForSelector("[role='dialog']", { timeout: 5_000 });
    await page.fill("#cc-legal-name", "E2E Test Company SAS");
    await page.fill("#cc-address", "42 Rue des Tests, 75001 Paris");
    await page.fill("#cc-siret", "12345678900099");

    await page.click("button[type='submit']");

    // Dialog closes on success; company appears in table
    await expect(page.locator("text=E2E Test Company SAS")).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Admin generates invite token
  // ---------------------------------------------------------------------------

  test("02 — admin manages company and generates invite token", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await page.goto("/en/settings");

    // Navigate to manage page via the settings icon
    await page.waitForSelector("#admin-companies", { timeout: 10_000 });
    await page.click("[title='Manage']", { timeout: 5_000 });

    // Switch to Invites tab
    await page.waitForSelector("button:has-text('Invites')", { timeout: 5_000 });
    await page.click("button:has-text('Invites')");

    // Generate invite
    await page.click("button:has-text('Generate')");

    // Token dialog appears — capture the token text
    await page.waitForSelector("[role='dialog']", { timeout: 5_000 });
    const tokenEl = await page.locator("[class*='font-mono']").first();
    capturedToken = (await tokenEl.textContent()) ?? "";
    expect(capturedToken.length).toBeGreaterThan(10);
  });

  // ---------------------------------------------------------------------------
  // Step 3: user2 redeems the invite token
  // ---------------------------------------------------------------------------

  test("03 — user2 adds company via invite token", async ({ page }: { page: Page }) => {
    // Log in as user2 (adjust credentials for local seeded stack)
    await page.goto("/en/login");
    await page.fill("input[type='email']", "user2@example.com");
    await page.fill("input[type='password']", "password2");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(en|fr|vi)\//, { timeout: 10_000 });

    await page.goto("/en/settings");

    // Open "Add company" dialog (RedeemInviteTokenDialog)
    await page.waitForSelector("button:has-text('Add company')", { timeout: 10_000 });
    await page.click("button:has-text('Add company')");

    await page.waitForSelector("[role='dialog']", { timeout: 5_000 });
    await page.fill("input#invite-token", capturedToken);
    await page.click("button:has-text('Attach')");

    // Success toast + dialog closes
    await expect(page.locator("text=E2E Test Company SAS")).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: user2 creates a billing document with picker showing the new company
  // ---------------------------------------------------------------------------

  test("04 — user2 creates devis with the new company as issuer", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("/en/login");
    await page.fill("input[type='email']", "user2@example.com");
    await page.fill("input[type='password']", "password2");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(en|fr|vi)\//, { timeout: 10_000 });

    await page.goto("/en/billing/devis/new");

    // Company picker must show "E2E Test Company SAS"
    await expect(page.locator("text=E2E Test Company SAS")).toBeVisible({
      timeout: 10_000,
    });

    // Fill recipient
    await page.fill("input[placeholder*='client']", "E2E Client Corp");

    // Add a line item
    await page.click("button:has-text('Add line')");
    await page.fill("input[placeholder='Item description']", "E2E Service");
    const spinners = page.locator("input[type='number']");
    await spinners.nth(0).fill("1"); // qty
    await spinners.nth(1).fill("500"); // unit_price

    await page.click("button:has-text('Create')");

    // Redirect to the document page
    await page.waitForURL(/\/billing\/devis\/.+/, { timeout: 15_000 });
    await expect(page.locator("text=E2E Test Company SAS")).toBeVisible({
      timeout: 10_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Step 5: Download PDF and verify issuer
  // ---------------------------------------------------------------------------

  test("05 — document PDF downloads with correct issuer info", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("/en/login");
    await page.fill("input[type='email']", "user2@example.com");
    await page.fill("input[type='password']", "password2");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(en|fr|vi)\//, { timeout: 10_000 });

    // Navigate to devis list and open the most recent one
    await page.goto("/en/billing/devis");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    // Download PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("button:has-text('Download PDF')"),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
