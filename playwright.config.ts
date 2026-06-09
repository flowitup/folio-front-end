import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Seeds the deterministic dataset when E2E_SEED=1; fail-soft no-op otherwise.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // sequential for workflow tests
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    // Mobile browser project — emulates a phone (viewport, touch, mobile UA).
    // The redesign targets this viewport; the mobile E2E gate runs here.
    // `hasTouch` keeps Radix/shadcn pointer interactions on the touch path.
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // don't restart if already running
    timeout: 30000,
  },
});
