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
