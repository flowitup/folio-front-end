/**
 * billing-templates-flow.spec.ts — Billing document templates happy-path E2E.
 *
 * Scenario:
 *   1. Log in as admin → /en/billing/templates → assert list (or empty state) renders
 *   2. Click "New template" → land on /billing/templates/new
 *   3. Pick kind (Quote) + fill name → Submit ("New template")
 *   4. Assert "Template created." toast + redirect back to list + the new card shows
 *   5. Cleanup: open the template → Delete → confirm → assert it disappears
 *
 * CI skip:
 *   Set TEST_E2E_TEMPLATES=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts and companies-flow.spec.ts.
 *
 * Run locally:
 *   TEST_E2E_TEMPLATES=1 npx playwright test e2e/billing-templates-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";

const RUN = Boolean(process.env.TEST_E2E_TEMPLATES);

// Unique name per run so the create assertion is unambiguous and the
// duplicate-name (409) guard never trips on a re-run.
const TEMPLATE_NAME = `E2E Template ${Date.now()}`;

test.describe("Billing templates happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_TEMPLATES=1 to run locally");

  test("create a template, see it in the list, then delete it", async ({
    page,
  }: {
    page: Page;
  }) => {
    // ── 1. List renders (empty state OK) ──────────────────────────────────────
    await loginAsAdmin(page);
    await page.goto("/en/billing/templates");

    // list.title = "Templates" (heading). Either the grid or empty state is fine.
    await expect(
      page.getByRole("heading", { name: "Templates" })
    ).toBeVisible({ timeout: 10_000 });

    // ── 2. Click create → /billing/templates/new ──────────────────────────────
    // Header button label = list.new = "New template".
    // The empty-state CTA ("Create your first template") also navigates here;
    // the header button is always present, so prefer it.
    await page.getByRole("button", { name: "New template" }).first().click();
    await page.waitForURL(/\/billing\/templates\/new/, { timeout: 10_000 });

    // ── 3. Fill the form ──────────────────────────────────────────────────────
    // Kind is a shadcn <Select> (trigger id="tpl-kind"); default value is "devis"
    // ("Quote") so we can leave it, but exercise the picker explicitly.
    await page.waitForSelector("#tpl-kind", { timeout: 10_000 });
    await page.click("#tpl-kind");
    // SelectItem label form.kindDevis = "Quote".
    await page.getByRole("option", { name: "Quote" }).click();

    // Name input id="tpl-name".
    await page.fill("#tpl-name", TEMPLATE_NAME);

    // ── 4. Submit ─────────────────────────────────────────────────────────────
    // On create the submit button label is form.titleCreate = "New template".
    // Scope to the footer button (exact match) to avoid the header nav button.
    await page.getByRole("button", { name: "New template", exact: true }).last().click();

    // Toast: "Template created." (hard-coded in billing-template-form.tsx).
    await expect(page.getByText("Template created.")).toBeVisible({ timeout: 8_000 });

    // Redirects back to the list; the new card name is visible.
    await page.waitForURL(/\/billing\/templates(\?.*)?$/, { timeout: 10_000 });
    await expect(page.getByText(TEMPLATE_NAME)).toBeVisible({ timeout: 10_000 });

    // ── 5. Cleanup: delete the template ───────────────────────────────────────
    // Card "Delete" trigger is an icon-only ghost button (Trash2). Scope to the
    // card containing our unique name, then click its destructive trigger.
    const card = page
      .locator(".folio-card")
      .filter({ hasText: TEMPLATE_NAME });
    // The Trash2 button has the red text class; it is the last action button.
    await card.locator("button.text-red-500").click();

    // AlertDialog confirm — list.actions.deleteConfirm = "Delete".
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: "Delete" }).click();

    // Toast "Template deleted." + card removed from list.
    await expect(page.getByText("Template deleted.")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(TEMPLATE_NAME)).toHaveCount(0, { timeout: 8_000 });
  });
});
