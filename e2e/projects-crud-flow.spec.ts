/**
 * E2E: Projects list + create-project happy path.
 *
 * Scenarios:
 *   1. Projects list shows seeded projects (Downtown Office Tower visible).
 *   2. Create a new project via the dialog → new card appears in the list.
 *
 * Selectors confirmed from source:
 *   - Projects list cards render project.name in <h3>
 *       → src/app/[locale]/(app)/projects/page.tsx:309-311
 *   - Create button = Topbar "New project" (projects.newProject), which routes
 *     to /projects?new=1 and the page opens CreateProjectDialog on that param
 *       → src/components/layout/Topbar.tsx:118-120 + page.tsx:98-103, en.json:135
 *   - Empty-state fallback create button = projects.createFirst (used only when
 *     there are zero projects) → page.tsx:534-541
 *   - Create dialog fields: #create-project-name + #create-project-address
 *       → src/components/project/create-project-dialog.tsx:83-92, 99-106
 *   - Submit button label = projects.create ("Create")
 *       → create-project-dialog.tsx:120-129, en.json:147
 *
 * NOTE (source vs task hint): the create dialog has NO budget field and emits
 * NO success toast — on success it simply closes and refetches, so the new card
 * appears in the list (create-project-dialog.tsx:60-70). The spec asserts the
 * card, not a budget input or toast, to match the real component.
 *
 * CI skip: requires a running backend (Docker stack) with seeded data.
 * Skipped unless TEST_E2E_PROJECTS=1.
 *
 * Run locally:
 *   TEST_E2E_PROJECTS=1 npx playwright test e2e/projects-crud-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_PROJECTS);

test.describe("Projects CRUD flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PROJECTS=1 to run locally");

  test("projects list shows seeded projects", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/projects");

    await expect(
      page.getByRole("heading", { name: SEED_PROJECTS.downtown }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("create a new project", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
    await page.goto("/en/projects");

    // Wait for the list to settle so the seeded data (non-empty state) is rendered.
    await expect(
      page.getByRole("heading", { name: SEED_PROJECTS.downtown }),
    ).toBeVisible({ timeout: 15_000 });

    const newName = `E2E Project ${Date.now()}`;

    // Open the create dialog. The "New project" button lives in the Topbar and
    // routes to ?new=1, which the projects page consumes to open the dialog.
    // TODO(verify): on mobile/narrow viewports the Topbar action button hides
    // its label; default Playwright viewport is desktop so getByRole works.
    await page.getByRole("button", { name: /new project/i }).first().click();

    // Dialog is open — fields are id-anchored.
    await page.waitForSelector("#create-project-name", { timeout: 10_000 });
    await page.fill("#create-project-name", newName);
    await page.fill("#create-project-address", "1 Rue des Tests, 75001 Paris");

    // Submit ("Create"). On success the dialog closes and the list refetches.
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // On success the project is created, the list refetches, and the new project
    // becomes the active one (its name appears in the project switcher + card).
    // Scope to the visible match: the desktop sidebar switcher is rendered but
    // display:none on mobile (it stays first in the DOM), so an unfiltered
    // .first() would resolve to that hidden node on a phone viewport. The mobile
    // shell surfaces the name in the topbar switcher / card instead.
    await expect(
      page.getByText(newName).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
