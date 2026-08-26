/**
 * i18n parity tests for the bank-credit-release keys.
 *
 * Asserts en/fr/vi all carry the same `projects.bankRelease.*` key set, that
 * every value is present and non-empty, and that the translations are actually
 * translated (not copy-pasted from English).
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const BANK_RELEASE_KEYS = [
  "title",
  "overDrawn",
  "drawsMeta",
  "headlineMeta",
  "segmentHint",
  "creditLabel",
  "leftLabel",
  "largestDraw",
  "lastDraw",
  "noCredit",
  "noCreditHint",
  "openSettings",
  "noReleases",
  "settingsCardTitle",
  "settingsCardHint",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const block = (m: any) => m.projects.bankRelease as Record<string, unknown>;
const locales = { en: block(en), fr: block(fr), vi: block(vi) };

describe("projects.bankRelease i18n parity — presence and non-empty", () => {
  for (const [name, messages] of Object.entries(locales)) {
    for (const key of BANK_RELEASE_KEYS) {
      it(`${name}.projects.bankRelease.${key} exists and is non-empty`, () => {
        const value = messages[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    }
  }
});

describe("projects.bankRelease i18n parity — key set symmetry", () => {
  it("fr and vi have exactly the en key set", () => {
    const enKeys = Object.keys(locales.en).sort();
    expect(Object.keys(locales.fr).sort()).toEqual(enKeys);
    expect(Object.keys(locales.vi).sort()).toEqual(enKeys);
  });
});

describe("projects.bankRelease i18n parity — values are translated", () => {
  for (const key of ["title", "largestDraw", "noCredit"] as const) {
    it(`fr.${key} differs from en`, () => {
      expect(locales.fr[key]).not.toBe(locales.en[key]);
    });
    it(`vi.${key} differs from en`, () => {
      expect(locales.vi[key]).not.toBe(locales.en[key]);
    });
  }
});

describe("projects.bankRelease i18n parity — ICU placeholders match", () => {
  const placeholders = (v: string) => (v.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
  for (const key of BANK_RELEASE_KEYS) {
    it(`fr/vi ${key} carry the same placeholders as en`, () => {
      const expected = placeholders(locales.en[key] as string);
      expect(placeholders(locales.fr[key] as string)).toEqual(expected);
      expect(placeholders(locales.vi[key] as string)).toEqual(expected);
    });
  }
});
