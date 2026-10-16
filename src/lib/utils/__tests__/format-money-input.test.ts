import { describe, it, expect } from "vitest";
import { formatMoneyInput } from "../format-money-input";
import { parseMoneyInput } from "../parse-money-input";

describe("formatMoneyInput", () => {
  it.each([
    ["fr", 1234567.89, "1 234 567,89"],
    ["en", 1234567.89, "1 234 567.89"],
    ["vi", 150000, "150 000"],
    ["en", 150000, "150 000"],
  ])("%s %d → %s", (locale, amount, expected) => {
    expect(formatMoneyInput(amount, locale)).toBe(expected);
  });

  it("reads back to the same amount in every locale", () => {
    for (const locale of ["fr", "en", "vi"]) {
      for (const amount of [1234567.89, 150000, 0.5, 12.3, 999.99]) {
        expect(parseMoneyInput(formatMoneyInput(amount, locale))).toBe(amount);
      }
    }
  });
});
