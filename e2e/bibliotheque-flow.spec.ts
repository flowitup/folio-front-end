/**
 * bibliotheque-flow.spec.ts — Product library (bibliothèque) structural E2E.
 *
 * Scenario (minimal / structure-only — the library may be UNSEEDED):
 *   1. Log in as admin → /en/bibliotheque
 *   2. Assert the page renders: heading "Product Library" is always present
 *      (both the seeded-grid branch and the no-company / empty branch render it).
 *   3. If a search input exists (only when a company is attached), type a query
 *      and assert the list either filters down or the empty-state copy shows.
 *      Either outcome is acceptable — we assert structure, not products.
 *
 * CI skip:
 *   Set TEST_E2E_BIBLIOTHEQUE=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts and companies-flow.spec.ts.
 *
 * Run locally:
 *   TEST_E2E_BIBLIOTHEQUE=1 npx playwright test e2e/bibliotheque-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";

const RUN = Boolean(process.env.TEST_E2E_BIBLIOTHEQUE);

test.describe("Bibliothèque (product library) structural flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_BIBLIOTHEQUE=1 to run locally");

  test("page renders and search filters (or shows empty state)", async ({
    page,
  }: {
    page: Page;
  }) => {
    // ── 1. Navigate ───────────────────────────────────────────────────────────
    await loginAsAdmin(page);
    await page.goto("/en/bibliotheque");

    // ── 2. Heading always renders (bibliotheque.title = "Product Library") ────
    await expect(
      page.getByRole("heading", { name: "Product Library" })
    ).toBeVisible({ timeout: 10_000 });

    // Let the client component finish its initial products fetch (or settle on
    // the no-company empty branch). Both outcomes are valid here.
    await page.waitForLoadState("networkidle");

    // ── 3. Optional: exercise search if the input is present ──────────────────
    // The search input (placeholder bibliotheque.searchPlaceholder = "Search
    // products…") only renders in the client branch, i.e. when a company is
    // attached. If absent (no-company empty branch) we assert the empty-state
    // copy instead and stop — both are acceptable.
    const searchInput = page.getByPlaceholder("Search products…");

    if ((await searchInput.count()) === 0) {
      // No-company branch: bibliotheque.noResults = "No products found."
      await expect(page.getByText("No products found.")).toBeVisible({
        timeout: 5_000,
      });
      return;
    }

    // Type a query unlikely to match anything so the assertion is deterministic
    // regardless of seed contents. Search is debounced 300ms in the client.
    await searchInput.fill("zzzznonexistentproductquery");
    await page.waitForTimeout(800); // > 300ms debounce + a fetch round-trip

    // Either the grid filtered to zero (empty-state copy shows) or — in the
    // unlikely event of a match — at least one product card renders. Assert the
    // page settled into one of those two structural states.
    const emptyState = page.getByText("No products found.");
    const productCards = page.locator(".folio-card");

    await expect
      .poll(
        async () =>
          (await emptyState.count()) > 0 || (await productCards.count()) > 0,
        { timeout: 8_000 }
      )
      .toBe(true);
  });
});
