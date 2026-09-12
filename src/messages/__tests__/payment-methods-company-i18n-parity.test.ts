/**
 * i18n parity for the payment-methods surface in Settings › Company.
 *
 * The section used to be a settings tab of its own, with a company picker and a
 * read-only variant for non-admins. It now sits inside the Company tab, which
 * already resolves the company and only renders admin tools to an admin — so
 * the picker/empty/read-only copy went with it, and `loadError` is the one
 * wrapper-level string left. This pins both halves: the surviving key must be
 * translated in all three locales, and the retired ones must stay deleted.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const locales = {
  en: en as unknown as Record<string, Record<string, unknown>>,
  fr: fr as unknown as Record<string, Record<string, unknown>>,
  vi: vi as unknown as Record<string, Record<string, unknown>>,
};

/** Keys the card still renders itself, on top of PaymentMethodsSection's own. */
const LIVE_KEYS = ["title", "loadError"] as const;

/** Keys that existed only for the standalone settings tab. */
const RETIRED_PM_KEYS = [
  "companyLabel",
  "noCompanies",
  "noMethodsReadOnly",
  "readOnlyNote",
] as const;

describe("Settings › Company payment methods i18n parity", () => {
  it.each(["en", "fr", "vi"] as const)("%s carries every live key, non-empty", (loc) => {
    const pm = locales[loc]["paymentMethods"] as Record<string, unknown>;
    for (const key of LIVE_KEYS) {
      expect(typeof pm[key], `${loc}.paymentMethods.${key}`).toBe("string");
      expect((pm[key] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(["fr", "vi"] as const)("%s values are translated, not copied from en", (loc) => {
    const enPm = locales.en["paymentMethods"] as Record<string, unknown>;
    const pm = locales[loc]["paymentMethods"] as Record<string, unknown>;
    for (const key of LIVE_KEYS) {
      expect(pm[key], `${loc}.paymentMethods.${key}`).not.toBe(enPm[key]);
    }
  });

  it.each(["en", "fr", "vi"] as const)(
    "%s keeps no message behind the retired standalone tab",
    (loc) => {
      const pm = locales[loc]["paymentMethods"] as Record<string, unknown>;
      for (const key of RETIRED_PM_KEYS) {
        expect(pm[key], `${loc}.paymentMethods.${key}`).toBeUndefined();
      }
      // The nav label went with the tab it named.
      expect(locales[loc]["settings"]["paymentMethods"]).toBeUndefined();
    }
  );
});
