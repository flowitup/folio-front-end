/**
 * Billing ↔ project release-funds E2E.
 *
 * Case: create an invoice (facture) in billing, associate it with a project via
 * the optional project picker, then verify the document's amount + status appear
 * in that project's release-funds section ("Released Funds" tab).
 *
 * CI skip: requires a running backend (Docker stack) with seeded data, matching
 * the env-gated pattern of the other billing specs. Run locally:
 *   TEST_E2E_BILLING_PROJECT=1 E2E_SEED=1 \
 *     npx playwright test e2e/billing-project-release-funds-flow.spec.ts
 *
 * Prerequisite handled in beforeAll: billing-create requires the caller to be
 * attached to a company. We ensure one via the API (create → invite-token →
 * attach-by-token) if the admin has none yet.
 */

import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";
import { ADMIN, SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_BILLING_PROJECT);
const API = process.env.E2E_API_BASE || "http://localhost:5000/api/v1";

let downtownProjectId = "";

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  return (await res.json()).access_token as string;
}

test.describe("Billing ↔ project release-funds flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_BILLING_PROJECT=1 to run locally");

  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext();
    const token = await adminToken(ctx);
    const headers = { Authorization: `Bearer ${token}` };

    // Resolve the seeded Downtown project id.
    const projectsRes = await ctx.get(`${API}/projects`, { headers });
    const projectsBody = await projectsRes.json();
    const projects = Array.isArray(projectsBody)
      ? projectsBody
      : projectsBody.projects ?? projectsBody.items ?? [];
    downtownProjectId =
      projects.find((p: { name: string }) => p.name === SEED_PROJECTS.downtown)?.id ??
      projects[0]?.id ??
      "";
    expect(downtownProjectId, "seeded project id resolved").not.toBe("");

    // Ensure the admin is attached to at least one company (billing prerequisite).
    const mineRes = await ctx.get(`${API}/companies`, { headers });
    const mineBody = await mineRes.json();
    const companies = Array.isArray(mineBody) ? mineBody : mineBody.companies ?? [];
    if (companies.length === 0) {
      const co = await (
        await ctx.post(`${API}/companies`, {
          headers,
          data: { legal_name: "E2E Release-Funds Co SAS", address: "1 Rue de Test, 75001 Paris" },
        })
      ).json();
      const tok = await (
        await ctx.post(`${API}/companies/${co.id}/invite-tokens?regenerate=true`, {
          headers,
          data: { role: "admin" },
        })
      ).json();
      await ctx.post(`${API}/companies/attach-by-token`, { headers, data: { token: tok.token } });
    }
    await ctx.dispose();
  });

  test("invoice linked to a project appears in release funds with its status", async ({ page }) => {
    const recipient = "Release Funds E2E Client";

    await loginAsAdmin(page);

    // 1. Create a facture and link it to the Downtown project via the picker.
    await page.goto("/en/billing/factures/new");
    await page.waitForSelector("#recipient-name", { timeout: 15_000 });
    await page.fill("#recipient-name", recipient);

    // Select the project in the optional project picker.
    await page.click("#project-picker");
    await page.getByRole("option", { name: SEED_PROJECTS.downtown }).click();

    // Add a line item. Description is a free-text Combobox: open it, type into
    // the CommandInput, then Enter to commit the typed value.
    await page.click("button:has-text('Add line')");
    // The description combobox trigger has no accessible name; identify it by its
    // placeholder text content.
    await page.getByRole("combobox").filter({ hasText: "Item description" }).click();
    const descInput = page.getByPlaceholder("Item description");
    await descInput.fill("Release funds E2E works");
    await descInput.press("Enter");

    // qty 3 × 400 = 1200 HT, 1440 TTC @ 20%.
    const numbers = page.locator("input[type='number']");
    await numbers.nth(0).fill("3");
    await numbers.nth(1).fill("400");

    // Submit — redirects to the document edit page on success.
    await page.click("button:has-text('Create')");
    await page.waitForURL(/\/billing\/factures\/[^/]+$/, { timeout: 20_000 });

    // 2. Open the project's invoices page → Released Funds tab.
    await page.goto(`/en/projects/${downtownProjectId}/invoices`);
    await page.getByRole("button", { name: "Released Funds", exact: true }).click();

    // 3. The linked-documents list shows the facture with its amount + status.
    await expect(page.getByText("Linked quotes & invoices")).toBeVisible({ timeout: 15_000 });
    // The recipient may match multiple rows across repeated local runs; assert on
    // the first matching row that this run's document is among them.
    const row = page.locator("tr", { hasText: recipient }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("Invoice"); // kind label (facture)
    await expect(row).toContainText("Draft"); // status label
    await expect(row).toContainText("440,00"); // amount TTC (3 × 400 + 20% = 1 440,00 €)
  });
});
