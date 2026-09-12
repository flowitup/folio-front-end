import { describe, it, expect } from "vitest";
import { normalizeFrenchPhone, formatFrenchPhone } from "../phone-number";

describe("normalizeFrenchPhone", () => {
  it.each([
    ["0612345678", "+33612345678"],
    ["06 12 34 56 78", "+33612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["01 42 34 56 78", "+33142345678"],
    // The login field states `FR +33` beside the number and invites the national
    // form without its trunk 0, so that form has to normalise too.
    ["6 12 34 56 78", "+33612345678"],
    ["612345678", "+33612345678"],
  ])("normalises the French number %s", (raw, expected) => {
    expect(normalizeFrenchPhone(raw)).toBe(expected);
  });

  it.each([
    "+84 912-345-678",
    "0084912345678",
    "+44 20 7946 0958",
    "+1 202 555 0173",
  ])("refuses %s: sign-in accepts French numbers only", (raw) => {
    expect(normalizeFrenchPhone(raw)).toBeNull();
  });

  it.each(["", "   ", "abc", "12345", "+0123456789", "61234567", "6123456789"])(
    "rejects %s",
    (raw) => {
      expect(normalizeFrenchPhone(raw)).toBeNull();
    },
  );
});

describe("formatFrenchPhone", () => {
  it.each([
    ["+33640838057", "+336 40 83 80 57"],
    ["+33612345678", "+336 12 34 56 78"],
    ["+33142345678", "+331 42 34 56 78"],
  ])("formats the French E.164 number %s as %s", (raw, expected) => {
    expect(formatFrenchPhone(raw)).toBe(expected);
  });

  it.each([
    // Not French E.164 at all.
    "+84912345678",
    "0612345678",
    "not-a-phone",
    "",
    // Already formatted — a second pass must be a no-op, not a mis-parse.
    "+336 40 83 80 57",
    // Wrong digit count for the E.164 shape (8, not 9, digits after +33).
    "+3361234567",
    // Leading 0 after +33 is not a valid French national number.
    "+330612345678",
  ])("returns %s unchanged when it is not a French E.164 number", (raw) => {
    expect(formatFrenchPhone(raw)).toBe(raw);
  });
});
