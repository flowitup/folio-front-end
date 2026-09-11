import { Page, APIRequestContext, expect } from "@playwright/test";
import { ADMIN, OTP_TEST_CODE } from "./seed-data";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

/**
 * Sign in through the real UI: phone number, then the SMS code.
 *
 * Email and password sign-in no longer exists — the backend has no
 * /auth/login route — so the suite drives the same two-step flow a real user
 * does, completing it with the backend's non-production `OTP_TEST_CODE`
 * instead of reading an actual SMS.
 */
export async function loginAs(page: Page, phone: string): Promise<void> {
  await page.goto("/en/login");

  await page.waitForSelector("#phone", { timeout: 10_000 });
  await page.fill("#phone", phone);
  await page.getByRole("button", { name: /send code/i }).click();

  // Step two only renders once the backend has accepted the request.
  await page.waitForSelector("#code", { timeout: 15_000 });
  await page.fill("#code", OTP_TEST_CODE);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await page.waitForURL(/\/(en|fr|vi)\/(dashboard|projects)/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/login/);
}

/** Back-compatible admin login used by the existing spec suite. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN.phone);
}

/**
 * Obtain an access token over HTTP, without a browser.
 *
 * Used by specs that set up state through the API before driving the UI.
 * Mirrors the UI flow — request a code, then exchange it — because that is
 * now the only way the backend issues tokens.
 */
export async function apiSignIn(
  ctx: APIRequestContext,
  phone: string = ADMIN.phone
): Promise<string> {
  await ctx.post(`${API_BASE}/auth/otp/request`, { data: { phone } });
  const verify = await ctx.post(`${API_BASE}/auth/otp/verify`, {
    data: { phone, code: OTP_TEST_CODE },
  });
  if (!verify.ok()) {
    throw new Error(
      `Phone sign-in failed for ${phone} (HTTP ${verify.status()}). ` +
        "Is the backend running with FLASK_ENV=development and OTP_TEST_CODE set?"
    );
  }
  return (await verify.json()).access_token as string;
}
