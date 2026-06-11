/**
 * i18n parity tests for refund-to-company payment keys in the invoices namespace.
 *
 * Asserts that en/fr/vi all carry identical key sets for the added refund keys,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// Flat dot-path keys added for the refund feature (relative to invoices.refund).
const REFUND_KEYS = [
  "status.refundable",
  "status.refundPending",
  "status.refunded",
  "action.transfer",
  "transferSuccess",
  "transferForbidden",
  "transferError",
  "companySpentOfReleased",
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
const enRefund = (en.invoices as any).refund as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frRefund = (fr.invoices as any).refund as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viRefund = (vi.invoices as any).refund as Record<string, unknown>;

describe("invoices refund i18n parity — key presence and non-empty", () => {
  for (const key of REFUND_KEYS) {
    it(`en.invoices.refund.${key} exists and is non-empty`, () => {
      const value = getNestedValue(enRefund, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.invoices.refund.${key} exists and is non-empty`, () => {
      const value = getNestedValue(frRefund, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.invoices.refund.${key} exists and is non-empty`, () => {
      const value = getNestedValue(viRefund, key);
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("invoices refund i18n parity — key set symmetry", () => {
  it("fr has all the same refund keys as en", () => {
    for (const key of REFUND_KEYS) {
      const value = getNestedValue(frRefund, key);
      expect(value, `missing fr key: refund.${key}`).toBeDefined();
    }
  });

  it("vi has all the same refund keys as en", () => {
    for (const key of REFUND_KEYS) {
      const value = getNestedValue(viRefund, key);
      expect(value, `missing vi key: refund.${key}`).toBeDefined();
    }
  });
});

describe("invoices refund i18n parity — locale values differ (not copy-paste)", () => {
  it("fr refund.status.refunded differs from en", () => {
    const enVal = getNestedValue(enRefund, "status.refunded") as string;
    const frVal = getNestedValue(frRefund, "status.refunded") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("vi refund.status.refunded differs from en", () => {
    const enVal = getNestedValue(enRefund, "status.refunded") as string;
    const viVal = getNestedValue(viRefund, "status.refunded") as string;
    expect(viVal).not.toBe(enVal);
  });
});
