/**
 * i18n parity tests for the refunded-by split and summary KPI keys added to
 * the billing.refundable namespace.
 *
 * Asserts that en/fr/vi all carry identical key sets for the added keys,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// Flat dot-path keys added for the refunded-by split + summary cards feature
// (relative to billing.refundable).
const REFUNDABLE_KEYS = [
  "action.refundedByCompany",
  "action.refundedByBank",
  "action.refundedByBoth",
  "summary.refundedTotal",
  "summary.refundedByCompany",
  "summary.refundedByBank",
  "summary.refundable",
  "summary.companyShare",
  "summary.bothShare",
  "summary.bankShare",
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
const enRefundable = (en.billing as any).refundable as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frRefundable = (fr.billing as any).refundable as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viRefundable = (vi.billing as any).refundable as Record<string, unknown>;

describe("billing.refundable refunded-by/summary i18n parity — key presence and non-empty", () => {
  for (const key of REFUNDABLE_KEYS) {
    it(`en.billing.refundable.${key} exists and is non-empty`, () => {
      const value = getNestedValue(enRefundable, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.billing.refundable.${key} exists and is non-empty`, () => {
      const value = getNestedValue(frRefundable, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.billing.refundable.${key} exists and is non-empty`, () => {
      const value = getNestedValue(viRefundable, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("billing.refundable refunded-by/summary i18n parity — key set symmetry", () => {
  it("fr has all the same keys as en", () => {
    for (const key of REFUNDABLE_KEYS) {
      const value = getNestedValue(frRefundable, key);
      expect(value, `missing fr key: refundable.${key}`).toBeDefined();
    }
  });

  it("vi has all the same keys as en", () => {
    for (const key of REFUNDABLE_KEYS) {
      const value = getNestedValue(viRefundable, key);
      expect(value, `missing vi key: refundable.${key}`).toBeDefined();
    }
  });
});

describe("billing.refundable refunded-by/summary i18n parity — locale values differ (not copy-paste)", () => {
  it("fr summary.refundedTotal differs from en", () => {
    const enVal = getNestedValue(enRefundable, "summary.refundedTotal") as string;
    const frVal = getNestedValue(frRefundable, "summary.refundedTotal") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("vi summary.refundedTotal differs from en", () => {
    const enVal = getNestedValue(enRefundable, "summary.refundedTotal") as string;
    const viVal = getNestedValue(viRefundable, "summary.refundedTotal") as string;
    expect(viVal).not.toBe(enVal);
  });
});
