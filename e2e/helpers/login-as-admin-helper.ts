import { Page, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(en|vi)\/(dashboard|projects)/);
  await expect(page).not.toHaveURL(/\/login/);
}
