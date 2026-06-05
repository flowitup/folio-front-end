import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

// Unique test data to avoid conflicts
const WORKER_NAME = `E2E Worker ${Date.now()}`;
const DAILY_RATE = "150.00";

// Project ID from seeded data (or discover dynamically)
const PROJECT_ID = process.env.TEST_PROJECT_ID || "";

async function getFirstProjectId(page: Page): Promise<string> {
  // Navigate to projects page and intercept the API response
  // The API is at localhost:5000/api/v1/projects
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/v1/projects") && resp.status() === 200,
    { timeout: 15000 }
  );

  await page.goto("/en/projects");

  try {
    const response = await responsePromise;
    const data = await response.json();
    if (data.projects && data.projects.length > 0) {
      return data.projects[0].id;
    }
  } catch {
    // Response parsing failed, try UI fallback
  }

  // UI fallback: check for project cards or empty state
  const projectCard = page.locator("h3.truncate").first();
  const emptyState = page.getByText("No projects yet");

  await Promise.race([
    projectCard.waitFor({ timeout: 5000 }),
    emptyState.waitFor({ timeout: 5000 }),
  ]).catch(() => {});

  if (await emptyState.isVisible()) {
    throw new Error("No project found. Ensure Docker backend is running with seeded data.");
  }

  throw new Error("Could not determine project ID. Set TEST_PROJECT_ID env var.");
}

test.describe("Labor Charge Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`Browser error: ${msg.text()}`);
      }
    });
    page.on("pageerror", (error) => console.log(`Page error: ${error.message}`));

    // Log ALL network requests for debugging
    page.on("request", (request) => {
      if (request.url().includes("/api/")) {
        console.log(`>> REQUEST: ${request.method()} ${request.url()}`);
      }
    });
    page.on("response", (response) => {
      if (response.url().includes("/api/")) {
        console.log(`<< RESPONSE: ${response.status()} ${response.url()}`);
      }
      if (response.status() >= 400) {
        console.log(`HTTP ERROR ${response.status()}: ${response.url()}`);
      }
    });

    await loginAsAdmin(page);
  });

  test("full workflow: add worker \u2192 log day \u2192 verify summary \u2192 cleanup", async ({
    page,
  }) => {
    const projectId = PROJECT_ID || (await getFirstProjectId(page));
    await page.goto(`/en/projects/${projectId}/labor`);
    await page.waitForLoadState("networkidle");

    // The labor page opens on the Summary tab \u2014 switch to Workers.
    await page.getByRole("button", { name: "Workers" }).click();

    // --- Add a worker -------------------------------------------------------
    await page.getByRole("button", { name: "Add worker" }).click();
    const addDialog = page.locator('[data-slot="dialog-content"]');
    await expect(addDialog).toBeVisible({ timeout: 10000 });
    // Worker identity is a Person: open the typeahead, type a fresh name and
    // create it via the "Create …" affordance.
    await addDialog.getByRole("combobox").first().click();
    await page.getByTestId("person-typeahead-input").fill(WORKER_NAME);
    await page.getByRole("option", { name: /Create/ }).click();
    await addDialog.locator("#dailyRate").fill(DAILY_RATE);

    const createWorker = page.waitForResponse(
      (r) => r.url().includes("/workers") && r.request().method() === "POST",
      { timeout: 15000 }
    );
    await addDialog.getByRole("button", { name: "Save" }).click();
    expect((await createWorker).status()).toBeLessThan(400);
    await expect(addDialog).not.toBeVisible({ timeout: 5000 });

    // Worker appears in the Workers grid.
    await expect(page.getByText(WORKER_NAME).first()).toBeVisible({ timeout: 10000 });

    // --- Log a day for the worker via the Log-day dialog --------------------
    await page.getByRole("button", { name: "Attendance" }).click();
    await page.waitForLoadState("networkidle");

    // Two "Log day" buttons exist (topbar + attendance tab); use the main one.
    await page.getByRole("main").getByRole("button", { name: "Log day" }).click();
    const logDialog = page.locator('[data-slot="dialog-content"]');
    await expect(logDialog).toBeVisible({ timeout: 10000 });

    // Toggle the worker's tile (a button whose accessible name includes the name).
    await logDialog
      .getByRole("button", { name: new RegExp(WORKER_NAME) })
      .first()
      .click();

    const createEntry = page.waitForResponse(
      (r) => r.url().includes("/labor-entries") && r.request().method() === "POST",
      { timeout: 15000 }
    );
    await logDialog.getByRole("button", { name: /^Save \(/ }).click();
    expect((await createEntry).status()).toBeLessThan(400);
    await expect(logDialog).not.toBeVisible({ timeout: 5000 });

    // Entry shows up on the attendance tab.
    await expect(page.getByText(WORKER_NAME).first()).toBeVisible({ timeout: 10000 });

    // --- Verify on the Summary tab -----------------------------------------
    await page.getByRole("button", { name: "Summary" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(WORKER_NAME).first()).toBeVisible({ timeout: 10000 });

    // --- Cleanup: delete the entry -----------------------------------------
    await page.getByRole("button", { name: "Attendance" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "List" }).click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();

    // --- Cleanup: deactivate the worker ------------------------------------
    await page.getByRole("button", { name: "Workers" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    const deactivateResp = page.waitForResponse(
      (r) => /\/workers\//.test(r.url()) && r.request().method() === "DELETE",
      { timeout: 15000 }
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Deactivate" })
      .click();
    expect((await deactivateResp).status()).toBeLessThan(400);
  });
});
