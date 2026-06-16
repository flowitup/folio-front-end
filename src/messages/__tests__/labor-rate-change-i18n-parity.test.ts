/**
 * i18n parity tests for labor.rateChange namespace
 *
 * Asserts that en/fr/vi all carry identical key sets under labor.rateChange,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// ── Key extraction ────────────────────────────────────────────────────────────

const enKeys = Object.keys(en.labor.rateChange).sort();
const frKeys = Object.keys(fr.labor.rateChange).sort();
const viKeys = Object.keys(vi.labor.rateChange).sort();

// ── Parity tests ──────────────────────────────────────────────────────────────

describe("labor.rateChange i18n parity — key sets", () => {
  it("fr has the same keys as en", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("vi has the same keys as en", () => {
    expect(viKeys).toEqual(enKeys);
  });

  it("all three locales share identical sorted key arrays", () => {
    expect(frKeys).toEqual(enKeys);
    expect(viKeys).toEqual(enKeys);
    expect(frKeys).toEqual(viKeys);
  });
});

// ── Required keys — presence and non-empty ────────────────────────────────────

const REQUIRED_KEYS = [
  "adjust",
  "title",
  "current",
  "newRate",
  "effectiveDate",
  "add",
  "history",
  "noChanges",
  "delete",
  "addedToast",
  "deletedToast",
  "effectiveFrom",
  "errorGeneric",
  "errorRatePositive",
] as const;

type RateChangeKey = keyof typeof en.labor.rateChange;

describe("labor.rateChange i18n parity — required keys present and non-empty", () => {
  for (const key of REQUIRED_KEYS) {
    it(`en.labor.rateChange.${key} exists and is non-empty`, () => {
      const value = en.labor.rateChange[key as RateChangeKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.labor.rateChange.${key} exists and is non-empty`, () => {
      const value = fr.labor.rateChange[key as RateChangeKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.labor.rateChange.${key} exists and is non-empty`, () => {
      const value = vi.labor.rateChange[key as RateChangeKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
