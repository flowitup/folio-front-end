/**
 * E2E: Project documents flow (happy path).
 *
 * Scenario:
 *   1. Login as admin → open the Downtown Office Tower project (resolve its id)
 *   2. Go to /en/projects/<id>/documents
 *   3. Upload e2e/fixtures/sample.pdf via the hidden file input (setInputFiles)
 *   4. Assert a row for "sample.pdf" appears + the upload success toast
 *   5. Delete that row → confirm in the AlertDialog → assert the row is gone
 *
 * Env flag: TEST_E2E_DOCUMENTS — requires a running backend (Docker stack) with
 * seeded data. Skipped in CI unless TEST_E2E_DOCUMENTS=1.
 *
 * Run locally:
 *   TEST_E2E_DOCUMENTS=1 npx playwright test e2e/project-documents-flow.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_DOCUMENTS);

test.describe("Project documents flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_DOCUMENTS=1 to run locally");

  test("upload a PDF → row appears + toast → delete → row gone", async ({ page }) => {
    // ── 1. Login + resolve project id ────────────────────────────────────────
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    // ── 2. Navigate to the documents sub-route ───────────────────────────────
    await page.goto(`/en/projects/${pid}/documents`);
    await page.waitForLoadState("networkidle");

    // ── 3. Upload sample.pdf via the hidden file input ───────────────────────
    // documents-upload.tsx renders <input type="file" hidden> (line ~372).
    await page.setInputFiles("input[type=file]", "e2e/fixtures/sample.pdf");

    // ── 4. Assert the new row + upload success toast ─────────────────────────
    // Toast string: documents.toast.uploadSuccess = "{filename} uploaded".
    await expect(page.getByText("sample.pdf uploaded")).toBeVisible({ timeout: 15_000 });

    // The list renders twice — desktop table rows (documents-list-desktop) and
    // mobile cards (documents-list-mobile). Target the unit holding the filename
    // in whichever copy the viewport shows.
    const docUnitAll = page.locator(
      '[data-testid="documents-list-desktop"] tbody tr, [data-testid="documents-list-mobile"] > *'
    );
    const row = docUnitAll
      .filter({ hasText: "sample.pdf" })
      .filter({ visible: true })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // ── 5. Delete the row → confirm in the AlertDialog ───────────────────────
    // Row delete action button: aria-label = documents.list.actions.delete = "Delete".
    await row.getByRole("button", { name: "Delete" }).click();

    // Confirm dialog (documents-delete-dialog.tsx): destructive button text
    // documents.delete.confirm = "Delete". Scope to the dialog to avoid the
    // row's same-named delete button.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete document?")).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Delete" }).click();

    // delete success toast: documents.delete.success = "Document deleted".
    await expect(page.getByText("Document deleted")).toBeVisible({ timeout: 10_000 });

    // ── Assert the row/card is gone ──────────────────────────────────────────
    await expect(
      docUnitAll.filter({ hasText: "sample.pdf" })
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
