/**
 * E2E: Project Photos (Media) happy-path flow.
 *
 * Scenario:
 *   1. Login as admin → open seeded "Downtown Office Tower" project
 *   2. Go to /en/projects/{id}/photos
 *   3. Open the upload panel, upload e2e/fixtures/sample.png via the hidden
 *      <input type=file> → assert success toast + a thumbnail appears
 *   4. Click the thumbnail → assert the lightbox dialog opens with an image
 *   5. Close the lightbox, reopen, delete the photo (confirm) → assert removed
 *
 * Env flag: TEST_E2E_PHOTOS
 *
 * Run locally:
 *   TEST_E2E_PHOTOS=1 npx playwright test e2e/project-photos-flow.spec.ts
 */

import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_PHOTOS);

const SAMPLE_PNG = path.join(__dirname, "fixtures", "sample.png");

test.describe("Project photos happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PHOTOS=1 to run locally");

  test("upload → thumbnail + toast → lightbox → delete", async ({ page }) => {
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    await page.goto(`/en/projects/${pid}/photos`);
    await page.waitForLoadState("networkidle");

    // Header confirms we're on the Media page (photos.title = "Media").
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible({
      timeout: 15_000,
    });

    // ── Open the upload panel ───────────────────────────────────────────────
    // Both the header button and the empty-state button use photos.addPhotos
    // ("Add media"). Click the first visible one to reveal <PhotosUpload>.
    await page.getByRole("button", { name: "Add media" }).first().click();

    // ── Upload sample.png via the hidden file input ─────────────────────────
    // The picker input is hidden; setInputFiles drives it directly.
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PNG);

    // Success toast (photos.uploadSuccess = "Photos uploaded").
    await expect(page.getByText("Photos uploaded")).toBeVisible({ timeout: 20_000 });

    // ── A thumbnail should appear ───────────────────────────────────────────
    // PhotoThumb renders a <button> whose aria-label is the caption/filename.
    // Scope to the date-grouped grid sections to avoid matching action buttons.
    const thumb = page.locator("section[aria-label] button").first();
    await expect(thumb).toBeVisible({ timeout: 20_000 });

    // ── Open the lightbox ───────────────────────────────────────────────────
    await thumb.click();

    const lightbox = page.getByRole("dialog");
    await expect(lightbox).toBeVisible({ timeout: 10_000 });
    // The original blob loads async; assert the <img> eventually renders.
    await expect(lightbox.locator("img")).toBeVisible({ timeout: 20_000 });

    // ── Close, reopen, delete ───────────────────────────────────────────────
    // Lightbox "Cancel" closes it (photos.cancel = "Cancel").
    await lightbox.getByRole("button", { name: "Cancel" }).click();
    await expect(lightbox).toBeHidden({ timeout: 10_000 });

    await thumb.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    // "Delete" opens the AlertDialog confirm (photos.delete = "Delete").
    await page.getByRole("button", { name: "Delete" }).first().click();

    // Confirm dialog: photos.deleteConfirm.title = "Delete photo?".
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Delete photo?")).toBeVisible({ timeout: 10_000 });
    // The destructive confirm action is also labelled "Delete".
    await confirm.getByRole("button", { name: "Delete" }).click();

    // ── Photo removed from the gallery ──────────────────────────────────────
    await expect(thumb).toBeHidden({ timeout: 20_000 });
  });
});
