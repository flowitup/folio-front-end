/**
 * Billing happy-path E2E scenario.
 *
 * Flow: log in → set company_profile → create devis → mark sent →
 *       mark accepted → convert to facture → mark paid → download PDF
 *
 * CI skip: This spec requires a running backend (Docker stack) with seeded data.
 * It is intentionally skipped in CI when TEST_E2E_BILLING is not set,
 * matching the existing pattern in labor-charge-full-workflow.spec.ts.
 *
 * Run locally:
 *   TEST_E2E_BILLING=1 npx playwright test e2e/billing-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

// ---------------------------------------------------------------------------
// CI guard — skip entire suite when env not configured
// ---------------------------------------------------------------------------

const RUN_BILLING_E2E = Boolean(process.env.TEST_E2E_BILLING);

test.describe("Billing happy-path flow", () => {
  test.skip(!RUN_BILLING_E2E, "Skipped in CI: set TEST_E2E_BILLING=1 to run locally");

  // -------------------------------------------------------------------------
  // Step 1: Set company profile
  // -------------------------------------------------------------------------

  test("01 — set company profile", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/settings#company-profile");

    await page.waitForSelector("#cp-legal-name", { timeout: 10_000 });
    await page.fill("#cp-legal-name", "E2E Test Company SAS");
    await page.fill("#cp-address", "1 Rue des Tests, 75001 Paris");

    await page.click("button:has-text('Save')");

    await expect(page.getByText("Company profile saved.")).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // Step 2: Create a devis
  // -------------------------------------------------------------------------

  test("02 — create a devis", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/billing/devis/new");

    await page.waitForSelector("#recipient-name", { timeout: 10_000 });

    // Fill recipient
    await page.fill("#recipient-name", "E2E Client Corp");

    // Add a line item
    await page.click("button:has-text('Add line')");
    await page.waitForSelector("input[placeholder='Item description']");
    await page.fill("input[placeholder='Item description']", "E2E consulting");

    // qty and unit price — first two spinbutton inputs
    const spinButtons = page.locator("input[type='number']");
    await spinButtons.nth(0).fill("2");
    await spinButtons.nth(1).fill("500");

    // Submit
    await page.click("button:has-text('Create')");

    // Should redirect to the edit page
    await page.waitForURL(/\/billing\/devis\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByText("Document saved.").or(page.getByText("Document created."))).toBeVisible({
      timeout: 8_000,
    });
  });

  // -------------------------------------------------------------------------
  // Step 3: Mark devis as Sent
  // -------------------------------------------------------------------------

  test("03 — mark devis sent", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    // Navigate to devis list, click most recent
    await page.goto("/en/billing/devis");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    await page.waitForURL(/\/billing\/devis\/[^/]+$/, { timeout: 10_000 });

    // Open status menu
    await page.click("button:has-text('Change status')");
    await page.click("text=Mark as Sent");

    await expect(page.getByText("Status updated to Sent.")).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // Step 4: Mark devis as Accepted
  // -------------------------------------------------------------------------

  test("04 — mark devis accepted", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/billing/devis");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    await page.waitForURL(/\/billing\/devis\/[^/]+$/, { timeout: 10_000 });

    await page.click("button:has-text('Change status')");
    await page.click("text=Mark as Accepted");

    await expect(page.getByText("Status updated to Accepted.")).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // Step 5: Convert devis to facture
  // -------------------------------------------------------------------------

  test("05 — convert devis to facture", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/billing/devis");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    await page.waitForURL(/\/billing\/devis\/[^/]+$/, { timeout: 10_000 });

    await page.click("button:has-text('Convert to Facture')");

    // Should redirect to the new facture's edit page
    await page.waitForURL(/\/billing\/factures\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByText("Devis converted to facture.")).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // Step 6: Mark facture as Paid
  // -------------------------------------------------------------------------

  test("06 — mark facture paid", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    // We're already on the facture after redirect from step 5.
    // Navigate to factures list and pick the most recent.
    await page.goto("/en/billing/factures");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    await page.waitForURL(/\/billing\/factures\/[^/]+$/, { timeout: 10_000 });

    // Facture is in "draft" (from conversion) → mark sent first
    const changeStatusBtn = page.locator("button:has-text('Change status')");
    if (await changeStatusBtn.isVisible()) {
      await changeStatusBtn.click();
      const sentOption = page.locator("text=Mark as Sent");
      if (await sentOption.isVisible()) {
        await sentOption.click();
        await page.waitForTimeout(500);
        await changeStatusBtn.click();
      }
      await page.click("text=Mark as Paid");
    }

    await expect(page.getByText(/status updated to paid/i)).toBeVisible({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // Step 7: Download PDF
  // -------------------------------------------------------------------------

  test("07 — download PDF", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/billing/factures");
    await page.waitForSelector("table tbody tr", { timeout: 10_000 });
    await page.click("table tbody tr:first-child");

    await page.waitForURL(/\/billing\/factures\/[^/]+$/, { timeout: 10_000 });

    // Trigger download and assert it completes without error
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.click("button:has-text('Download PDF')"),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    await expect(page.getByText("PDF downloaded.")).toBeVisible({ timeout: 8_000 });
  });
});
