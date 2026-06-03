/**
 * E2E: Dashboard renders the selected project overview.
 *
 * Scenario:
 *   1. Login as admin.
 *   2. Open a seeded project by name (sets ProjectContext.selectedProject).
 *   3. Navigate to /en/dashboard.
 *   4. Assert the selected project's name renders as the hero heading AND
 *      a structural element (the "Build phases" ribbon) is present.
 *
 * Selectors confirmed from source:
 *   - Hero project name in <h2> = selectedProject.name
 *       → src/app/[locale]/(app)/dashboard/page.tsx:127-129 (project.name = selectedProject?.name)
 *   - Phase ribbon header <h3> = dashboard.buildPhases ("Build phases")
 *       → page.tsx:228-230, src/messages/en.json:90
 *   - "In progress" stamp (dashboard.inProgress) → page.tsx:123, en.json:81
 *
 * CI skip: requires a running backend (Docker stack) with seeded data.
 * Skipped unless TEST_E2E_DASHBOARD=1.
 *
 * Run locally:
 *   TEST_E2E_DASHBOARD=1 npx playwright test e2e/dashboard-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_DASHBOARD);

test.describe("Dashboard flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_DASHBOARD=1 to run locally");

  test("dashboard renders selected project overview", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    // Select the project — openProjectByName clicks the card and lands on the
    // project route, but it also persists selection in ProjectContext.
    await openProjectByName(page, SEED_PROJECTS.downtown);

    await page.goto("/en/dashboard");

    // Hero heading reflects the selected project's name (not the fallback).
    await expect(
      page.getByRole("heading", { name: SEED_PROJECTS.downtown, level: 2 }),
    ).toBeVisible({ timeout: 15_000 });

    // Structural element: the "Build phases" ribbon section header.
    await expect(
      page.getByRole("heading", { name: /build phases/i, level: 3 }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
