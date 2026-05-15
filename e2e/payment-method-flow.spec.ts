/**
 * payment-method-flow.spec.ts — Payment method golden-path E2E scenario.
 *
 * Flow:
 *   1. Login as admin → Settings → Companies → [id] → Payment methods section
 *   2. Add new method "Wise" → assert it appears in the list
 *   3. Navigate to a project's invoices page
 *   4. Open invoice form → Payment method dropdown → select "Wise" → save
 *   5. Expand invoice detail row → assert payment method shows "Wise"
 *   6. Go back to Settings → rename "Wise" → "Wise Business"
 *   7. Reload invoice list → assert snapshot still shows "Wise" (not renamed)
 *
 * CI skip:
 *   Set TEST_E2E_PAYMENT_METHODS=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts, companies-flow.spec.ts, etc.
 *
 * Required env vars (when TEST_E2E_PAYMENT_METHODS=1):
 *   ADMIN_EMAIL        — seeded admin user (default: admin@example.com)
 *   ADMIN_PASSWORD     — (default: password123)
 *   E2E_COMPANY_ID     — UUID of a company the admin belongs to
 *   E2E_PROJECT_ID     — UUID of a project under that company with ≥1 invoice
 *   E2E_INVOICE_ID     — UUID of a specific invoice to use for selection test
 *
 * Run locally:
 *   TEST_E2E_PAYMENT_METHODS=1 E2E_COMPANY_ID=<uuid> E2E_PROJECT_ID=<uuid> \
 *     E2E_INVOICE_ID=<uuid> npx playwright test e2e/payment-method-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

// ---------------------------------------------------------------------------
// CI guard
// ---------------------------------------------------------------------------

const RUN = Boolean(process.env.TEST_E2E_PAYMENT_METHODS);

const COMPANY_ID = process.env.E2E_COMPANY_ID ?? "";
const PROJECT_ID = process.env.E2E_PROJECT_ID ?? "";
const INVOICE_ID = process.env.E2E_INVOICE_ID ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToCompanySettings(page: Page) {
  await page.goto(`/en/settings/companies/${COMPANY_ID}`);
  await page.waitForSelector("text=Payment methods", { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Payment method golden-path flow", () => {
  test.skip(!RUN, "Skipped in CI — set TEST_E2E_PAYMENT_METHODS=1 to run locally");

  // Shared state captured between steps
  const addedMethodLabel = "Wise";

  test("01 — admin logs in and adds 'Wise' payment method in Settings", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await goToCompanySettings(page);

    // Locate the add-form input (placeholder: "e.g. Wise, Stripe, …")
    const addInput = page.getByRole("textbox", { name: /e\.g\./i });
    await addInput.fill(addedMethodLabel);
    await page.getByRole("button", { name: /^Add$/i }).click();

    // Assert "Wise" appears in the payment methods list
    await expect(page.getByText(addedMethodLabel)).toBeVisible({ timeout: 8_000 });
  });

  test("02 — navigate to project invoices and select 'Wise' on an invoice", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/en/projects/${PROJECT_ID}/invoices`);
    await page.waitForSelector("[data-testid='invoice-list'], table", {
      timeout: 10_000,
    });

    // Open the specific invoice's edit / detail controls
    // The invoice row should have an edit/open button — click it to open the form
    await page
      .getByTestId(`invoice-row-${INVOICE_ID}`)
      .or(page.getByRole("row").filter({ hasText: INVOICE_ID }))
      .first()
      .click();

    // Wait for payment method combobox to appear in the form / detail panel
    const pmCombobox = page.getByRole("combobox", { name: /payment method/i });
    await pmCombobox.waitFor({ timeout: 8_000 });
    await pmCombobox.click();

    // Select "Wise" from the dropdown
    await page.getByRole("option", { name: addedMethodLabel }).click();

    // Save the invoice
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForLoadState("networkidle");
  });

  test("03 — invoice detail row shows 'Wise' as the payment method snapshot", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/en/projects/${PROJECT_ID}/invoices`);
    await page.waitForSelector("[data-testid='invoice-list'], table", {
      timeout: 10_000,
    });

    // Expand the invoice detail row
    await page
      .getByTestId(`invoice-row-${INVOICE_ID}`)
      .or(page.getByRole("row").filter({ hasText: INVOICE_ID }))
      .first()
      .click();

    // Detail section should show the payment method label
    await expect(page.getByText(addedMethodLabel)).toBeVisible({ timeout: 8_000 });
  });

  test("04 — rename 'Wise' to 'Wise Business' in Settings", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await goToCompanySettings(page);

    // Click the edit (pencil) button for "Wise"
    await page
      .getByRole("button", { name: `Edit "${addedMethodLabel}"` })
      .click();

    // The inline input should appear with the current label value
    const editInput = page.locator(`input[value="${addedMethodLabel}"]`);
    await editInput.fill("Wise Business");
    await editInput.press("Enter");

    // Assert "Wise Business" now appears in the list
    await expect(page.getByText("Wise Business")).toBeVisible({ timeout: 8_000 });
  });

  test("05 — invoice detail still shows snapshot 'Wise', not 'Wise Business'", async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/en/projects/${PROJECT_ID}/invoices`);
    await page.waitForSelector("[data-testid='invoice-list'], table", {
      timeout: 10_000,
    });

    // Expand the invoice detail row
    await page
      .getByTestId(`invoice-row-${INVOICE_ID}`)
      .or(page.getByRole("row").filter({ hasText: INVOICE_ID }))
      .first()
      .click();

    // Snapshot label should still be "Wise" (stored at save time)
    await expect(page.getByText("Wise")).toBeVisible({ timeout: 8_000 });
    // And "Wise Business" should NOT appear in the detail section
    await expect(
      page.locator("[data-testid='invoice-detail']").getByText("Wise Business")
    ).toBeHidden({ timeout: 3_000 });
  });
});
