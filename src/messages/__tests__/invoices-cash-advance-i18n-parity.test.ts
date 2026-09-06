/**
 * i18n parity tests for the company cash-advance keys in the invoices namespace
 * (purse sub-line, form checkbox label/hint, row badge).
 *
 * Asserts that en/fr/vi all carry the keys, non-empty, and that fr/vi are not
 * copy-pasted from en.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const INVOICES_KEYS = [
  "summary.cashAdvance",
  "cashAdvance.label",
  "cashAdvance.hint",
  "cashAdvance.badge",
] as const;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enInvoices = en.invoices as any as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frInvoices = fr.invoices as any as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viInvoices = vi.invoices as any as Record<string, unknown>;

describe("invoices cash-advance i18n parity — key presence and non-empty", () => {
  for (const key of INVOICES_KEYS) {
    for (const [locale, messages] of [
      ["en", enInvoices],
      ["fr", frInvoices],
      ["vi", viInvoices],
    ] as const) {
      it(`${locale}.invoices.${key} exists and is non-empty`, () => {
        const value = getNestedValue(messages, key);
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    }
  }

  it("summary.cashAdvance carries the {amount} placeholder in every locale", () => {
    for (const messages of [enInvoices, frInvoices, viInvoices]) {
      expect(getNestedValue(messages, "summary.cashAdvance")).toContain("{amount}");
    }
  });
});

describe("invoices cash-advance i18n parity — locale values differ (not copy-paste)", () => {
  for (const key of ["summary.cashAdvance", "cashAdvance.label", "cashAdvance.badge"] as const) {
    it(`fr ${key} differs from en`, () => {
      expect(getNestedValue(frInvoices, key)).not.toBe(getNestedValue(enInvoices, key));
    });
    it(`vi ${key} differs from en`, () => {
      expect(getNestedValue(viInvoices, key)).not.toBe(getNestedValue(enInvoices, key));
    });
  }
});
