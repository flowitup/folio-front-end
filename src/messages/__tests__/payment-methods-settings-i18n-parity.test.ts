/**
 * i18n parity for the Settings → Payment methods section.
 *
 * Covers the nav label plus the keys the settings-scoped wrapper adds
 * (company picker, empty/error states, read-only note). Each must exist in
 * en/fr/vi, be non-empty, and be locale-distinct so a missing translation
 * can't ship as an English string.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const PM_KEYS = [
  "companyLabel",
  "noCompanies",
  "loadError",
  "noMethodsReadOnly",
  "readOnlyNote",
] as const;

const locales = {
  en: en as unknown as Record<string, Record<string, unknown>>,
  fr: fr as unknown as Record<string, Record<string, unknown>>,
  vi: vi as unknown as Record<string, Record<string, unknown>>,
};

describe("Settings → Payment methods i18n parity", () => {
  it.each(["en", "fr", "vi"] as const)(
    "%s carries a non-empty settings.paymentMethods nav label",
    (loc) => {
      const label = locales[loc]["settings"]["paymentMethods"];
      expect(typeof label).toBe("string");
      expect((label as string).trim().length).toBeGreaterThan(0);
    }
  );

  it.each(["en", "fr", "vi"] as const)(
    "%s carries every paymentMethods settings key, non-empty",
    (loc) => {
      const pm = locales[loc]["paymentMethods"] as Record<string, unknown>;
      for (const key of PM_KEYS) {
        expect(typeof pm[key], `${loc}.paymentMethods.${key}`).toBe("string");
        expect((pm[key] as string).trim().length).toBeGreaterThan(0);
      }
    }
  );

  it.each(["fr", "vi"] as const)("%s values are translated, not copied from en", (loc) => {
    const enPm = locales.en["paymentMethods"] as Record<string, unknown>;
    const pm = locales[loc]["paymentMethods"] as Record<string, unknown>;
    for (const key of PM_KEYS) {
      expect(pm[key], `${loc}.paymentMethods.${key}`).not.toBe(enPm[key]);
    }
    expect(locales[loc]["settings"]["paymentMethods"]).not.toBe(
      locales.en["settings"]["paymentMethods"]
    );
  });
});
