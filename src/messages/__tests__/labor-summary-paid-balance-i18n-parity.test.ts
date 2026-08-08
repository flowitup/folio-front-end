/**
 * i18n parity test for the new labor.summaryUnassignedHint key backing the
 * Summary tab's all-history "Paid" column hint (e.g. "+ 2 unassigned").
 * The Paid/Balance column headers reuse the existing labor.payments.paid
 * and labor.payments.balance strings (already covered by
 * labor-payments-i18n-parity.test.ts), so only the new key needs its own
 * coverage here.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

describe("labor.summaryUnassignedHint i18n parity", () => {
  it("is present and non-empty in en/fr/vi", () => {
    for (const messages of [en, fr, vi]) {
      const value = messages.labor.summaryUnassignedHint;
      expect(typeof value).toBe("string");
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries the {n} placeholder in every locale", () => {
    for (const messages of [en, fr, vi]) {
      expect(messages.labor.summaryUnassignedHint).toContain("{n}");
    }
  });
});

describe("labor summary unpaid/overpaid warning i18n parity", () => {
  const keys = [
    "summaryUnpaidWarning",
    "summaryUnpaidWarningTitle",
    "summaryOverpaidWarning",
    "summaryOverpaidWarningTitle",
  ] as const;

  it("all warning keys are present and non-empty in en/fr/vi", () => {
    for (const messages of [en, fr, vi]) {
      for (const key of keys) {
        const value = messages.labor[key];
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("badge labels carry the {amount} placeholder in every locale", () => {
    for (const messages of [en, fr, vi]) {
      expect(messages.labor.summaryUnpaidWarning).toContain("{amount}");
      expect(messages.labor.summaryOverpaidWarning).toContain("{amount}");
    }
  });
});
