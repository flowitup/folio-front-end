/**
 * Billing text caps: notes, terms, signature and payment terms longer than the
 * API accepts are caught in the form, with the field named.
 */

import { describe, it, expect } from "vitest";
import { firstTooLongField, MAX_BILLING_NOTES, MAX_PAYMENT_TERMS } from "@/lib/billing/text-limits";

describe("firstTooLongField", () => {
  it("returns null when every field fits", () => {
    expect(
      firstTooLongField([
        { label: "Notes", value: "n".repeat(MAX_BILLING_NOTES), max: MAX_BILLING_NOTES },
        { label: "Terms", value: "", max: MAX_BILLING_NOTES },
      ])
    ).toBeNull();
  });

  it("names the first field over its cap", () => {
    const tooLong = firstTooLongField([
      { label: "Notes", value: "short", max: MAX_BILLING_NOTES },
      { label: "Terms", value: "t".repeat(2990), max: MAX_BILLING_NOTES },
      { label: "Payment terms", value: "p".repeat(600), max: MAX_PAYMENT_TERMS },
    ]);
    expect(tooLong?.label).toBe("Terms");
    expect(tooLong?.max).toBe(MAX_BILLING_NOTES);
  });

  it("ignores surrounding spaces, as the form trims before sending", () => {
    expect(
      firstTooLongField([{ label: "Notes", value: `  ${"n".repeat(MAX_BILLING_NOTES)}\n`, max: MAX_BILLING_NOTES }])
    ).toBeNull();
  });

  it("counts an emoji once, like the API", () => {
    expect(firstTooLongField([{ label: "Payment terms", value: "👍".repeat(500), max: MAX_PAYMENT_TERMS }])).toBeNull();
    expect(
      firstTooLongField([{ label: "Payment terms", value: "👍".repeat(501), max: MAX_PAYMENT_TERMS }])?.label
    ).toBe("Payment terms");
  });
});
