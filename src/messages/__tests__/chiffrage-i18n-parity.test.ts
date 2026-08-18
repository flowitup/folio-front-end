/**
 * chiffrage-i18n-parity.test.ts
 *
 * Vietnamese is a real audience here, not a placeholder locale, so this checks
 * the three files carry the same keys, that none is blank, and that values were
 * actually translated rather than copy-pasted from English.
 */

import { describe, it, expect } from "vitest";

import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

type Messages = Record<string, Record<string, string>>;

const locales: Record<string, Messages> = {
  en: en as unknown as Messages,
  fr: fr as unknown as Messages,
  vi: vi as unknown as Messages,
};

/**
 * Values that legitimately read the same in every locale: fiscal abbreviations,
 * and the sample address — the chantiers are in France, so the example stays a
 * French street address whichever language the UI is read in.
 */
const SHARED_BY_DESIGN = new Set([
  "tva",
  "storeAddressPlaceholder",
  "storeWebsitePlaceholder",
]);

describe("chiffrage i18n", () => {
  it("defines the namespace in every locale", () => {
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.chiffrage, `${name}.json is missing the chiffrage namespace`).toBeDefined();
    }
  });

  it("carries an identical key set across en/fr/vi", () => {
    const keys = Object.fromEntries(
      Object.entries(locales).map(([name, m]) => [name, Object.keys(m.chiffrage).sort()])
    );
    expect(keys.fr).toEqual(keys.en);
    expect(keys.vi).toEqual(keys.en);
  });

  it("has no blank value", () => {
    for (const [name, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages.chiffrage)) {
        expect(typeof value, `${name}.chiffrage.${key}`).toBe("string");
        expect(value.trim().length, `${name}.chiffrage.${key} is blank`).toBeGreaterThan(0);
      }
    }
  });

  it("was actually translated, not copied from English", () => {
    const copied = Object.keys(locales.en.chiffrage).filter(
      (key) =>
        !SHARED_BY_DESIGN.has(key) &&
        locales.en.chiffrage[key] === locales.fr.chiffrage[key] &&
        locales.en.chiffrage[key] === locales.vi.chiffrage[key]
    );
    expect(copied).toEqual([]);
  });

  it("names the section in the sidebar in every locale", () => {
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.navigation.chiffrage, `${name}.navigation.chiffrage`).toBeTruthy();
    }
  });
});
