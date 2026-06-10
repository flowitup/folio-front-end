/**
 * i18n parity tests for new VAT-related keys in the invoices namespace.
 *
 * Asserts that en/fr/vi all carry identical key sets for the added VAT keys,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// Keys added for the VAT feature.
const VAT_KEYS = ["colTva", "vatRate", "totalHt", "totalTva", "totalTtc"] as const;

type InvoicesMsg = typeof en.invoices;
type VatKey = (typeof VAT_KEYS)[number];

describe("invoices VAT i18n parity — key presence and non-empty", () => {
  for (const key of VAT_KEYS) {
    it(`en.invoices.${key} exists and is non-empty`, () => {
      const value = (en.invoices as InvoicesMsg & Record<VatKey, string>)[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.invoices.${key} exists and is non-empty`, () => {
      const value = (fr.invoices as InvoicesMsg & Record<VatKey, string>)[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.invoices.${key} exists and is non-empty`, () => {
      const value = (vi.invoices as InvoicesMsg & Record<VatKey, string>)[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("invoices VAT i18n parity — key set symmetry", () => {
  it("fr has the same VAT keys as en", () => {
    for (const key of VAT_KEYS) {
      expect(key in fr.invoices).toBe(true);
    }
  });

  it("vi has the same VAT keys as en", () => {
    for (const key of VAT_KEYS) {
      expect(key in vi.invoices).toBe(true);
    }
  });
});
