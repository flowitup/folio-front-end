/**
 * E2E: Locale switching flow (i18n)
 *
 * Scenario:
 *   1. Login as admin.
 *   2. Direct-nav to /fr/projects  → assert French sidebar nav copy renders,
 *      and the English copy is NOT present.
 *   3. Direct-nav to /vi/projects  → assert Vietnamese sidebar nav copy renders.
 *   4. From /en/projects, open the top-right LanguageSwitcher, choose "Français"
 *      → assert URL becomes /fr/... and the French copy appears.
 *
 * Asserted i18n key: `navigation.dashboard` — the sidebar "home/overview" nav
 * label, rendered on every app page via <Sidebar>. Chosen because its value is
 * clearly distinct across all three locales (no shared brand words):
 *   en: "Overview"
 *   fr: "Aperçu"
 *   vi: "Tổng quan"
 * (source: src/messages/{en,fr,vi}.json → navigation.dashboard;
 *  rendered in src/components/layout/Sidebar.tsx:224 as
 *  `<span className="font-medium">{t(item.key)}</span>` inside a nav <Link>.)
 *
 * Locale switcher control: src/components/language-switcher.tsx
 *   - Trigger: a <button> with aria-label = common.language
 *       (en "Language" / fr "Langue" / vi "Ngôn ngữ"), rendered in the Topbar
 *       (src/components/layout/Topbar.tsx:228).
 *   - Menu items are labeled by localeNames (src/i18n/config.ts):
 *       en "English" / vi "Tiếng Việt" / fr "Français".
 *   - Selecting an item calls router.replace(pathname, { locale }), swapping
 *     only the /<locale> URL prefix while preserving the pathname.
 *
 * Env flag: gated behind TEST_E2E_LOCALE (skipped in CI by default).
 * Requires a running FE + backend (Docker stack) with seeded admin user.
 *
 * Run locally:
 *   TEST_E2E_LOCALE=1 npx playwright test e2e/locale-switching-flow.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";

const RUN = Boolean(process.env.TEST_E2E_LOCALE);

// navigation.dashboard literals — see header docstring.
const NAV_DASHBOARD = {
  en: "Overview",
  fr: "Aperçu",
  vi: "Tổng quan",
} as const;

test.describe("Locale switching flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_LOCALE=1 to run locally");

  // -------------------------------------------------------------------------
  // fr direct-nav: French copy renders, English copy absent
  // -------------------------------------------------------------------------

  test("fr locale renders French copy", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    await page.goto("/fr/projects");
    await page.waitForURL(/\/fr\/projects/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // French nav label is visible. Scope to the visible match: the desktop
    // sidebar nav is display:none on mobile (but still first in the DOM), while
    // the mobile bottom-nav renders the same i18n label — target whichever the
    // current viewport actually shows.
    await expect(
      page.getByText(NAV_DASHBOARD.fr, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    // English label for the same key must NOT be present.
    await expect(page.getByText(NAV_DASHBOARD.en, { exact: true })).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // vi direct-nav: Vietnamese copy renders
  // -------------------------------------------------------------------------

  test("vi locale renders Vietnamese copy", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    await page.goto("/vi/projects");
    await page.waitForURL(/\/vi\/projects/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Target the viewport-visible nav label (desktop sidebar vs mobile
    // bottom-nav) — the hidden desktop sidebar is first in the DOM otherwise.
    await expect(
      page.getByText(NAV_DASHBOARD.vi, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    // English label for the same key must NOT be present.
    await expect(page.getByText(NAV_DASHBOARD.en, { exact: true })).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Switcher: en → Français changes URL prefix + on-page copy
  // -------------------------------------------------------------------------

  test("locale switcher changes language", async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);

    await page.goto("/en/projects");
    await page.waitForURL(/\/en\/projects/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Sanity: English copy is showing first (visible nav — sidebar on desktop,
    // bottom-nav on mobile).
    await expect(
      page.getByText(NAV_DASHBOARD.en, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    // Open the LanguageSwitcher dropdown. Trigger carries aria-label =
    // common.language ("Language" in the current en locale).
    // TODO(verify): aria-label text resolves to the en value "Language" while
    // the page is in /en; adjust the regex if the trigger is relabeled.
    await page
      .getByRole("button", { name: /language|langue|ngôn ngữ/i })
      .click();

    // Choose the "Français" item (label comes from localeNames.fr).
    await page.getByRole("menuitem", { name: /français/i }).click();

    // URL prefix should flip to /fr (pathname preserved by router.replace).
    // next-intl's router.replace is a client-side locale swap that fires no
    // "load" event, so waitForURL(default waitUntil:"load") would hang — assert
    // via toHaveURL, which polls the URL without waiting for a navigation.
    await expect(page).toHaveURL(/\/fr\/projects/, { timeout: 15_000 });

    // French copy should now render in the visible nav.
    await expect(
      page.getByText(NAV_DASHBOARD.fr, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
