/**
 * i18n parity tests for the company/personal released-funds split cards and
 * the auto-release attribution control in the invoices namespace.
 *
 * Asserts that en/fr/vi all carry identical key sets for the added keys,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// Flat dot-path keys added for the company/personal split (relative to invoices).
const INVOICES_KEYS = [
  "fundsReleasedCompany",
  "fundsReleasedPersonal",
  "refund.companySpentOfReleasedCompany",
  "refund.personalSpentOfReleasedPersonal",
  "releaseAttribution.label",
  "releaseAttribution.success",
  "releaseAttribution.error",
] as const;

/** Walk a dot-path into a nested object and return the leaf value. */
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

describe("invoices released-funds split i18n parity — key presence and non-empty", () => {
  for (const key of INVOICES_KEYS) {
    it(`en.invoices.${key} exists and is non-empty`, () => {
      const value = getNestedValue(enInvoices, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.invoices.${key} exists and is non-empty`, () => {
      const value = getNestedValue(frInvoices, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.invoices.${key} exists and is non-empty`, () => {
      const value = getNestedValue(viInvoices, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("invoices released-funds split i18n parity — key set symmetry", () => {
  it("fr has all the same keys as en", () => {
    for (const key of INVOICES_KEYS) {
      const value = getNestedValue(frInvoices, key);
      expect(value, `missing fr key: ${key}`).toBeDefined();
    }
  });

  it("vi has all the same keys as en", () => {
    for (const key of INVOICES_KEYS) {
      const value = getNestedValue(viInvoices, key);
      expect(value, `missing vi key: ${key}`).toBeDefined();
    }
  });
});

describe("invoices released-funds split i18n parity — locale values differ (not copy-paste)", () => {
  it("fr fundsReleasedCompany differs from en", () => {
    const enVal = getNestedValue(enInvoices, "fundsReleasedCompany") as string;
    const frVal = getNestedValue(frInvoices, "fundsReleasedCompany") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("vi fundsReleasedCompany differs from en", () => {
    const enVal = getNestedValue(enInvoices, "fundsReleasedCompany") as string;
    const viVal = getNestedValue(viInvoices, "fundsReleasedCompany") as string;
    expect(viVal).not.toBe(enVal);
  });

  it("fr releaseAttribution.label differs from en", () => {
    const enVal = getNestedValue(enInvoices, "releaseAttribution.label") as string;
    const frVal = getNestedValue(frInvoices, "releaseAttribution.label") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("vi releaseAttribution.label differs from en", () => {
    const enVal = getNestedValue(enInvoices, "releaseAttribution.label") as string;
    const viVal = getNestedValue(viInvoices, "releaseAttribution.label") as string;
    expect(viVal).not.toBe(enVal);
  });
});
