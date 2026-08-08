/**
 * i18n parity tests for the labor.payments namespace (Payments tab).
 *
 * Asserts that en/fr/vi carry identical key sets under labor.payments
 * (including the nested `status` sub-object), and that every key is
 * present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// ── Key extraction ────────────────────────────────────────────────────────────

const enKeys = Object.keys(en.labor.payments).sort();
const frKeys = Object.keys(fr.labor.payments).sort();
const viKeys = Object.keys(vi.labor.payments).sort();

const enStatusKeys = Object.keys(en.labor.payments.status).sort();
const frStatusKeys = Object.keys(fr.labor.payments.status).sort();
const viStatusKeys = Object.keys(vi.labor.payments.status).sort();

// ── Parity tests ──────────────────────────────────────────────────────────────

describe("labor.payments i18n parity — key sets", () => {
  it("fr has the same top-level keys as en", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("vi has the same top-level keys as en", () => {
    expect(viKeys).toEqual(enKeys);
  });

  it("fr has the same status keys as en", () => {
    expect(frStatusKeys).toEqual(enStatusKeys);
  });

  it("vi has the same status keys as en", () => {
    expect(viStatusKeys).toEqual(enStatusKeys);
  });
});

// ── Required keys — presence and non-empty ────────────────────────────────────

const REQUIRED_KEYS = [
  "tab",
  "statusColumn",
  "owed",
  "paid",
  "balance",
  "recordPayment",
  "recordPaymentFor",
  "recordedToast",
  "recordFailed",
  "errorWorkerRequired",
  "errorAmountPositive",
  "expandInvoices",
  "collapseInvoices",
  "viewInExpenses",
  "unassignedTitle",
  "unassignedHint",
  "invoiceCount",
  "assignWorker",
  "assignedToast",
  "assignFailed",
  "noMonthTitle",
  "assignToMonth",
  "emptyMonth",
  "loadFailed",
] as const;

const REQUIRED_STATUS_KEYS = ["unpaid", "partial", "settled", "overpaid"] as const;

type PaymentsKey = keyof typeof en.labor.payments;
type StatusKey = keyof typeof en.labor.payments.status;

describe("labor.payments i18n parity — required keys present and non-empty", () => {
  for (const key of REQUIRED_KEYS) {
    it(`en.labor.payments.${key} exists and is non-empty`, () => {
      const value = en.labor.payments[key as PaymentsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.labor.payments.${key} exists and is non-empty`, () => {
      const value = fr.labor.payments[key as PaymentsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.labor.payments.${key} exists and is non-empty`, () => {
      const value = vi.labor.payments[key as PaymentsKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }

  for (const key of REQUIRED_STATUS_KEYS) {
    it(`en.labor.payments.status.${key} exists and is non-empty`, () => {
      const value = en.labor.payments.status[key as StatusKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.labor.payments.status.${key} exists and is non-empty`, () => {
      const value = fr.labor.payments.status[key as StatusKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.labor.payments.status.${key} exists and is non-empty`, () => {
      const value = vi.labor.payments.status[key as StatusKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
