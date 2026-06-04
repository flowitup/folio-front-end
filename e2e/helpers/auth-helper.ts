import { Page, expect } from "@playwright/test";
import { ADMIN } from "./seed-data";

/**
 * Log in as an arbitrary seeded user. Generalized from the original
 * admin-only helper so role-specific specs can reuse it.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/en/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(en|fr|vi)\/(dashboard|projects)/);
  await expect(page).not.toHaveURL(/\/login/);
}

/** Back-compatible admin login used by the existing spec suite. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN.email, ADMIN.password);
}
