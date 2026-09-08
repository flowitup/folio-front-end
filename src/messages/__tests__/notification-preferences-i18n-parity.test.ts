/**
 * i18n parity for Settings → Notifications.
 *
 * Every key the section reads must exist in en/fr/vi, be non-empty, and differ
 * between locales so a missing translation cannot ship as an English string.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const TOP_KEYS = [
  "title",
  "intro",
  "loading",
  "loadError",
  "saveError",
  "pushEnabled",
  "pushEnabledDesc",
] as const;
const CATEGORY_KEYS = [
  "chat",
  "chatDesc",
  "attendance",
  "attendanceDesc",
  "tasks",
  "tasksDesc",
  "membership",
  "membershipDesc",
  "billing",
  "billingDesc",
] as const;

type Prefs = { categories: Record<string, string> } & Record<string, unknown>;
const prefs = {
  en: (en as { settings: { notificationPrefs: Prefs } }).settings.notificationPrefs,
  fr: (fr as { settings: { notificationPrefs: Prefs } }).settings.notificationPrefs,
  vi: (vi as { settings: { notificationPrefs: Prefs } }).settings.notificationPrefs,
};

describe("Settings → Notifications i18n parity", () => {
  it.each(["en", "fr", "vi"] as const)("%s carries every key, non-empty", (loc) => {
    for (const key of TOP_KEYS) {
      expect(typeof prefs[loc][key], `${loc}.${key}`).toBe("string");
      expect((prefs[loc][key] as string).trim().length, `${loc}.${key}`).toBeGreaterThan(0);
    }
    for (const key of CATEGORY_KEYS) {
      expect(typeof prefs[loc].categories[key], `${loc}.categories.${key}`).toBe("string");
      expect(prefs[loc].categories[key].trim().length, `${loc}.categories.${key}`).toBeGreaterThan(0);
    }
  });

  it("descriptions are translated, not copied from English", () => {
    for (const key of ["intro", "loadError", "saveError", "pushEnabledDesc"] as const) {
      expect(prefs.fr[key]).not.toBe(prefs.en[key]);
      expect(prefs.vi[key]).not.toBe(prefs.en[key]);
    }
    for (const key of CATEGORY_KEYS.filter((k) => k.endsWith("Desc"))) {
      expect(prefs.fr.categories[key]).not.toBe(prefs.en.categories[key]);
      expect(prefs.vi.categories[key]).not.toBe(prefs.en.categories[key]);
    }
  });
});
