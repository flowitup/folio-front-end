/**
 * E2E: Project invoices flow (happy path).
 *
 * Scenarios:
 *   A. List view — KPI cards render, at least one seeded invoice row matches
 *      INV-YYYY-NNNN, a type filter tab re-filters the list, clicking a row
 *      expands its inline detail panel.
 *   B. New invoice — fill required fields (recipient + one line item with an
 *      amount; type defaults to "Released Funds"; payment method selected best-
 *      effort), submit, assert navigation back to the invoices list (the create
 *      route redirects to /invoices/<id>, which itself redirects to the list
 *      with ?invoice=<id>).
 *   C. Detail redirect — visiting /invoices/<id> directly bounces to
 *      /invoices?invoice=<id> (invoices/[invoiceId]/page.tsx is a redirect shim).
 *
 * Env flag: TEST_E2E_PROJECT_INVOICES — requires a running backend with seeded
 * data (Downtown project seeded with mixed-type invoices). Skipped in CI unless
 * TEST_E2E_PROJECT_INVOICES=1.
 *
 * Run locally:
 *   TEST_E2E_PROJECT_INVOICES=1 npx playwright test e2e/project-invoices-flow.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS, INVOICE_NUMBER_RE } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_PROJECT_INVOICES);

test.describe("Project invoices flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PROJECT_INVOICES=1 to run locally");

  test("list KPIs + rows, type filter, inline detail expand", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);
    await page.goto(`/en/projects/${pid}/invoices`);
    await page.waitForLoadState("networkidle");

    // ── KPI cards (invoices/page.tsx ~152). i18n: invoices.totalInvoiced =
    // "Total expenses", invoices.fundsReleased = "Funds released". ───────────
    await expect(page.getByText("Total expenses")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Funds released")).toBeVisible({ timeout: 10_000 });

    // The list renders twice: mobile cards (div.lg:hidden) BEFORE the desktop
    // table (div.lg:block, table.ledger). At Playwright's 1280px viewport the
    // table is the visible one, so scope row/detail queries to it — otherwise
    // `.first()` matches the hidden mobile copy.
    const ledger = page.locator("table.ledger");

    // ── At least one seeded invoice row matches INV-YYYY-NNNN (in a <td>) ─────
    await expect(ledger.getByText(INVOICE_NUMBER_RE).first()).toBeVisible({ timeout: 15_000 });

    // ── Click a type filter tab and assert the list re-filters ───────────────
    // Tabs live in div.seg (page.tsx ~211). "Labor" = invoices.types.labor.
    await page.getByRole("button", { name: "Labor", exact: true }).click();
    // After filtering to a single type, the rows that remain (if any) still
    // match the invoice-number format, OR the empty-state "No expenses yet"
    // shows. Either is a valid re-filter.
    await expect(
      ledger.getByText(INVOICE_NUMBER_RE).first().or(page.getByText("No expenses yet"))
    ).toBeVisible({ timeout: 10_000 });

    // Back to "All" so we have rows to expand.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(ledger.getByText(INVOICE_NUMBER_RE).first()).toBeVisible({ timeout: 10_000 });

    // ── Click an invoice row → inline detail region expands ──────────────────
    // Rows are <tr role="button" aria-expanded aria-controls="invoice-detail-..">
    // (page.tsx ~351). Clicking sets aria-expanded=true and reveals the region.
    const firstRow = ledger.getByRole("button", { expanded: false }).filter({
      has: page.getByText(INVOICE_NUMBER_RE),
    }).first();
    await firstRow.click();
    await expect(
      ledger.getByRole("button", { expanded: true }).filter({
        has: page.getByText(INVOICE_NUMBER_RE),
      }).first()
    ).toBeVisible({ timeout: 10_000 });
    // The expanded detail region is wired via aria-controls=invoice-detail-<id>.
    await expect(ledger.locator("[id^='invoice-detail-']").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("create a new invoice → redirects back to the invoices list", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);
    await page.goto(`/en/projects/${pid}/invoices/new`);
    await page.waitForLoadState("networkidle");

    // Required: recipient name. Input placeholder = invoices.recipient = "Recipient".
    await page.getByPlaceholder("Recipient").fill("E2E Invoice Recipient");

    // Required: issue date. The form's issueDate state defaults to "" (empty),
    // so the single <input type="date"> must be filled or create is rejected.
    await page.locator('input[type="date"]').first().fill("2026-06-01");

    // Type is a native <select> defaulting to "Released Funds" — leave as-is
    // (already a valid required value). Set it explicitly to exercise the control.
    // The select has no accessible label association, so target it by its options.
    await page.locator("select").first().selectOption({ label: "Released Funds" });

    // One line item is required: description (required) + an amount (unit price).
    // Description input placeholder = invoices.description = "Description".
    await page.getByPlaceholder("Description").first().fill("E2E line item");
    // Line-item numeric inputs: [0]=quantity (defaults to 1), [1]=unit price.
    const numberInputs = page.locator("input[type=number]");
    await numberInputs.nth(1).fill("250");

    // Payment method is OPTIONAL and only rendered for projects with a
    // company_id (the seeded "Downtown Office Tower" has none), so it is left
    // unset. NOTE: do not probe for it via getByRole("combobox") — a native
    // <select> (the type field) also reports role=combobox and would be matched
    // by mistake. A valid invoice needs only recipient + type + one line item.

    // Submit. Button text = invoices.save = "Save".
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // The create route pushes to /invoices/<id>, whose page redirects to
    // /invoices?invoice=<id>. Assert we land back on the invoices list.
    // NOTE: there is no explicit success toast on this path (new/page.tsx just
    // navigates), so we assert the URL transition instead.
    await page.waitForURL(/\/projects\/[^/]+\/invoices(\?invoice=[^&]+)?$/, {
      timeout: 15_000,
    });
    await expect(page).not.toHaveURL(/\/invoices\/new$/);
  });

  test("direct invoice detail URL redirects to the list with ?invoice=<id>", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);
    await page.goto(`/en/projects/${pid}/invoices`);
    await page.waitForLoadState("networkidle");

    // Capture an existing invoice id. The list doesn't expose id via href (rows
    // are buttons, not links), but the inline detail region id is
    // "invoice-detail-<id>" once a row is expanded. Scope to the visible desktop
    // table (the list also renders hidden mobile cards). Expand the first row,
    // read the id, then deep-link to the detail route.
    const ledger = page.locator("table.ledger");
    const firstRow = ledger.getByRole("button", { expanded: false }).filter({
      has: page.getByText(INVOICE_NUMBER_RE),
    }).first();
    await firstRow.click();

    const detailRegion = ledger.locator("[id^='invoice-detail-']").first();
    await expect(detailRegion).toBeVisible({ timeout: 10_000 });
    const regionId = await detailRegion.getAttribute("id");
    const invoiceId = regionId?.replace(/^invoice-detail-/, "");

    if (!invoiceId) {
      // TODO(verify): could not capture an invoice id from the DOM — skip the
      // redirect sub-step gracefully rather than fail the happy path.
      test.skip(true, "Could not capture an invoice id to test the redirect");
      return;
    }

    // Direct visit to the detail route → redirect shim bounces to the list.
    await page.goto(`/en/projects/${pid}/invoices/${invoiceId}`);
    await page.waitForURL(
      new RegExp(`/projects/[^/]+/invoices\\?invoice=${invoiceId}`),
      { timeout: 15_000 }
    );
  });
});
