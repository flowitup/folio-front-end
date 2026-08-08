/**
 * i18n parity tests for the returns-avoir-purses feature's new invoices
 * namespace keys (settled_via / applied_to_invoice_id form controls, row
 * badges, "paid with avoir", and the purse-summary returns/outstanding lines).
 *
 * Asserts that en/fr/vi all carry identical key sets, each key is present and
 * non-empty in every locale, and locale-specific values aren't copy-pasted
 * from en where a real translation is expected.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// Flat dot-path keys, relative to the "invoices" namespace.
const TOP_LEVEL_KEYS = [
  "appliedTo",
  "appliedToInvoiceLabel",
  "appliedToInvoiceNone",
  "appliedToMethodHint",
  "appliedToMethodHintWithLabel",
  "paidWithAvoir",
  "settledVia.label",
  "settledVia.cash",
  "settledVia.avoir",
  "settledVia.avoirBadge",
  "settledVia.outstanding",
] as const;

const SUMMARY_KEYS = ["summary.returnsReceived", "summary.outstandingAvoirs"] as const;

const ALL_KEYS = [...TOP_LEVEL_KEYS, ...SUMMARY_KEYS];

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
const enInvoices = en.invoices as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frInvoices = fr.invoices as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viInvoices = vi.invoices as any;

describe("invoices avoir i18n parity — key presence and non-empty", () => {
  for (const key of ALL_KEYS) {
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

describe("invoices avoir i18n parity — key set symmetry", () => {
  it("fr has all the same avoir keys as en", () => {
    for (const key of ALL_KEYS) {
      expect(getNestedValue(frInvoices, key), `missing fr key: ${key}`).toBeDefined();
    }
  });

  it("vi has all the same avoir keys as en", () => {
    for (const key of ALL_KEYS) {
      expect(getNestedValue(viInvoices, key), `missing vi key: ${key}`).toBeDefined();
    }
  });
});

describe("invoices avoir i18n parity — locale values differ (not copy-paste)", () => {
  it("fr settledVia.label differs from en", () => {
    expect(getNestedValue(frInvoices, "settledVia.label")).not.toBe(
      getNestedValue(enInvoices, "settledVia.label"),
    );
  });

  it("vi settledVia.label differs from en", () => {
    expect(getNestedValue(viInvoices, "settledVia.label")).not.toBe(
      getNestedValue(enInvoices, "settledVia.label"),
    );
  });

  it("fr appliedToInvoiceLabel differs from en", () => {
    expect(getNestedValue(frInvoices, "appliedToInvoiceLabel")).not.toBe(
      getNestedValue(enInvoices, "appliedToInvoiceLabel"),
    );
  });

  it("vi appliedToInvoiceLabel differs from en", () => {
    expect(getNestedValue(viInvoices, "appliedToInvoiceLabel")).not.toBe(
      getNestedValue(enInvoices, "appliedToInvoiceLabel"),
    );
  });
});
