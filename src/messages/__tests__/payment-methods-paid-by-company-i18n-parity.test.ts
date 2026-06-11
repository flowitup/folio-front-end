/**
 * i18n parity test for paymentMethods.paidByCompany key.
 *
 * Asserts en/fr/vi each carry the key and that it is non-empty and
 * locale-distinct (not a copy-paste).
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enPm = (en.paymentMethods as any) as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frPm = (fr.paymentMethods as any) as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viPm = (vi.paymentMethods as any) as Record<string, unknown>;

describe("paymentMethods.paidByCompany i18n parity", () => {
  it("en.paymentMethods.paidByCompany is present and non-empty", () => {
    expect(typeof enPm["paidByCompany"]).toBe("string");
    expect((enPm["paidByCompany"] as string).trim().length).toBeGreaterThan(0);
  });

  it("fr.paymentMethods.paidByCompany is present and non-empty", () => {
    expect(typeof frPm["paidByCompany"]).toBe("string");
    expect((frPm["paidByCompany"] as string).trim().length).toBeGreaterThan(0);
  });

  it("vi.paymentMethods.paidByCompany is present and non-empty", () => {
    expect(typeof viPm["paidByCompany"]).toBe("string");
    expect((viPm["paidByCompany"] as string).trim().length).toBeGreaterThan(0);
  });

  it("fr value differs from en (not copy-paste)", () => {
    expect(frPm["paidByCompany"]).not.toBe(enPm["paidByCompany"]);
  });

  it("vi value differs from en (not copy-paste)", () => {
    expect(viPm["paidByCompany"]).not.toBe(enPm["paidByCompany"]);
  });
});
