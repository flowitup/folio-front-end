/**
 * i18n parity tests for the invoices.byWorker namespace (Expenses page's
 * worker-grouped labor display).
 *
 * Asserts that en/fr/vi carry identical key sets under invoices.byWorker,
 * and that every key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const enKeys = Object.keys(en.invoices.byWorker).sort();
const frKeys = Object.keys(fr.invoices.byWorker).sort();
const viKeys = Object.keys(vi.invoices.byWorker).sort();

describe("invoices.byWorker i18n parity — key sets", () => {
  it("fr has the same keys as en", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("vi has the same keys as en", () => {
    expect(viKeys).toEqual(enKeys);
  });
});

const REQUIRED_KEYS = ["totalPaid", "lastPayment", "noMonthGroup"] as const;

type ByWorkerKey = keyof typeof en.invoices.byWorker;

describe("invoices.byWorker i18n parity — required keys present and non-empty", () => {
  for (const key of REQUIRED_KEYS) {
    it(`en.invoices.byWorker.${key} exists and is non-empty`, () => {
      const value = en.invoices.byWorker[key as ByWorkerKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.invoices.byWorker.${key} exists and is non-empty`, () => {
      const value = fr.invoices.byWorker[key as ByWorkerKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.invoices.byWorker.${key} exists and is non-empty`, () => {
      const value = vi.invoices.byWorker[key as ByWorkerKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
