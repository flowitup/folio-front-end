/**
 * i18n parity tests for billing.form.items namespace — phase 07
 *
 * Asserts that en/fr/vi all carry identical key sets under billing.form.items,
 * and that each phase-07 key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// ── Required phase-07 keys ─────────────────────────────────────────────────

const PHASE_07_KEYS = [
  "categoryLabel",
  "categoryPlaceholder",
  "descriptionSuggestionsHeading",
  "noSuggestions",
  "categoryNoMatches",
] as const;

// ── Parity — key sets ──────────────────────────────────────────────────────

const enKeys = Object.keys(en.billing.form.items).sort();
const frKeys = Object.keys(fr.billing.form.items).sort();
const viKeys = Object.keys(vi.billing.form.items).sort();

describe("billing.form.items i18n parity — key sets", () => {
  it("fr has the same keys as en", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("vi has the same keys as en", () => {
    expect(viKeys).toEqual(enKeys);
  });

  it("all three locales share identical sorted key arrays", () => {
    expect(frKeys).toEqual(enKeys);
    expect(viKeys).toEqual(enKeys);
  });
});

// ── Phase-07 keys — present and non-empty ─────────────────────────────────

type ItemsKey = keyof typeof en.billing.form.items;

describe("billing.form.items i18n — phase-07 keys present and non-empty", () => {
  for (const key of PHASE_07_KEYS) {
    it(`en.billing.form.items.${key} is a non-empty string`, () => {
      const value = en.billing.form.items[key as ItemsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.billing.form.items.${key} is a non-empty string`, () => {
      const value = fr.billing.form.items[key as ItemsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.billing.form.items.${key} is a non-empty string`, () => {
      const value = vi.billing.form.items[key as ItemsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
