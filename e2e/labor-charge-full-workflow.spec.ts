import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/login-as-admin-helper";

// Unique test data to avoid conflicts
const WORKER_NAME = `E2E Worker ${Date.now()}`;
const DAILY_RATE = "150.00";
const PHONE = "0612345678";
const OVERRIDE_AMOUNT = "175.00";
const NOTE = "E2E test entry";

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

  test("full workflow: add worker → log attendance → verify summary → cleanup", async ({
    page,
  }) => {
    // Step 1: Navigate to labor page
    const projectId = PROJECT_ID || (await getFirstProjectId(page));
    await page.goto(`/en/projects/${projectId}/labor`);
    await page.waitForLoadState("networkidle");

    // Verify we're on the labor page (Workers tab is default)
    await expect(page.getByRole("button", { name: "Workers" })).toBeVisible();

    // Step 2: Add Worker
    const addWorkerBtn = page.getByRole("button", { name: "Add Worker" });
    await expect(addWorkerBtn).toBeVisible();
    await addWorkerBtn.click();

    // Wait for dialog to appear - use data-slot selector for Radix dialog
    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Fill worker form in dialog - use ID selectors which are more reliable
    await page.locator("#name").fill(WORKER_NAME);
    await page.locator("#dailyRate").fill(DAILY_RATE);
    await page.locator("#phone").fill(PHONE);

    // Click Save and wait for the API response
    const createWorkerResponse = page.waitForResponse(
      (resp) => resp.url().includes("/workers") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.getByRole("button", { name: "Save" }).click();

    // Wait for API response
    const response = await createWorkerResponse;
    expect(response.status()).toBeLessThan(400);
    console.log(`Create worker response status: ${response.status()}`);

    // Wait for the GET workers refresh that happens after create
    const refreshResponse = await page.waitForResponse(
      (resp) => resp.url().includes("/workers") && resp.request().method() === "GET",
      { timeout: 10000 }
    );
    console.log(`Refresh workers response status: ${refreshResponse.status()}`);
    const workersData = await refreshResponse.json();
    console.log(`Workers data: ${JSON.stringify(workersData)}`);

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Log current URL to verify we're still on labor page
    console.log(`Current URL after dialog close: ${page.url()}`);

    // Verify we're still on labor page (not redirected)
    await expect(page.getByRole("heading", { name: "Labor Charges" })).toBeVisible({ timeout: 5000 });

    // Verify worker appears in list
    await expect(page.getByText(WORKER_NAME)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/150,00/)).toBeVisible(); // EUR format

    // Step 3: Log Attendance (switch to Attendance tab)
    await page.getByRole("button", { name: "Attendance" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Log Attendance" }).click();

    // Select worker from dropdown (Radix Select)
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: WORKER_NAME }).click();

    // Date is pre-filled with today, fill override and note
    await page.getByLabel(/Rate Override/i).fill(OVERRIDE_AMOUNT);
    await page.getByLabel("Note").fill(NOTE);
    await page.getByRole("button", { name: "Save" }).click();

    // Verify entry appears in table
    await expect(page.getByText(WORKER_NAME)).toBeVisible();
    await expect(page.getByText(/175,00/)).toBeVisible(); // Override amount in EUR
    await expect(page.getByText(NOTE)).toBeVisible();

    // Step 4: Verify Summary
    await page.getByRole("button", { name: "Summary" }).click();
    await page.waitForLoadState("networkidle");

    // Verify worker name appears with correct total
    await expect(page.getByText(WORKER_NAME)).toBeVisible();
    await expect(page.getByText(/175,00/)).toBeVisible();

    // Step 5: Cleanup - Delete entry
    await page.getByRole("button", { name: "Attendance" }).click();
    await page.waitForLoadState("networkidle");

    // Click delete button on the entry (trash icon button)
    const entryRow = page.locator("div").filter({ hasText: WORKER_NAME }).first();
    await entryRow.getByRole("button").click();

    // Confirm deletion in dialog
    await page.getByRole("button", { name: "Delete" }).click();

    // Verify entry removed
    await expect(page.getByText(NOTE)).not.toBeVisible();

    // Step 6: Cleanup - Deactivate worker
    await page.getByRole("button", { name: "Workers" }).click();
    await page.waitForLoadState("networkidle");

    // Click deactivate button on the worker (user-x icon button)
    const workerCard = page.locator("div").filter({ hasText: WORKER_NAME }).first();
    const deactivateBtn = workerCard.getByRole("button").last();
    await deactivateBtn.click();

    // Confirm deactivation in dialog
    await page.getByRole("button", { name: "Deactivate" }).click();

    // Verify worker shows "Inactive" badge
    await expect(page.getByText("Inactive")).toBeVisible();
  });
});
