/**
 * parseMoneyInput must read fr/vi/en amounts exactly, and reject anything it
 * cannot read unambiguously instead of truncating it like parseFloat does.
 */

import { describe, it, expect } from "vitest";
import { formatMoneyInput, parseMoneyInput, parseMoneyInputDetailed } from "../parse-money-input";

describe("parseMoneyInput", () => {
  it.each([
    ["12 500,75", 12500.75],
    ["12 500,75", 12500.75],
    ["12 500,75", 12500.75],
    ["12.500,75", 12500.75],
    ["12,500.75", 12500.75],
    ["1000,50", 1000.5],
    ["1000.5", 1000.5],
    ["12500", 12500],
    ["1 234 567", 1234567],
    ["1.234.567", 1234567],
    ["1,234,567", 1234567],
    [" 42 € ", 42],
    ["0", 0],
  ])("reads %j as %d", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "   ", "10abc", "-5", "12,500", "12.500", "1,2,3", "1.2.3", "12,5.0", "1.23,45,6", "abc"])(
    "rejects %j",
    (input) => {
      expect(parseMoneyInput(input)).toBeNull();
    },
  );
});

describe("parseMoneyInput options", () => {
  it.each([
    ["45,90", { maxDecimals: 4 }, 45.9],
    ["1,859", { maxDecimals: 4, ambiguousGrouping: "decimal" }, 1.859],
    ["2,375", { maxDecimals: 3, ambiguousGrouping: "decimal" }, 2.375],
    ["0,125", { maxDecimals: 4 }, 0.125],
    ["1,2345", { maxDecimals: 4 }, 1.2345],
    ["1 234,5678", { maxDecimals: 4 }, 1234.5678],
    ["-50", { allowNegative: true }, -50],
    ["-12,5", { allowNegative: true, maxDecimals: 4 }, -12.5],
  ] as const)("reads %j with %j as %d", (input, options, expected) => {
    expect(parseMoneyInput(input, options)).toBe(expected);
  });

  it.each([
    ["1,85912", { maxDecimals: 4 }],
    ["2,3755", { maxDecimals: 3 }],
    ["-", { allowNegative: true }],
    ["--5", { allowNegative: true }],
    ["5-", { allowNegative: true }],
    ["1e3", { maxDecimals: 4 }],
    ["-5", { maxDecimals: 4 }],
  ] as const)("rejects %j with %j", (input, options) => {
    expect(parseMoneyInput(input, options)).toBeNull();
  });
});

describe("parseMoneyInputDetailed", () => {
  it.each([
    ["1,500", { maxDecimals: 4 }, 1500],
    ["1.340", { maxDecimals: 4 }, 1340],
    ["12,500", {}, 12500],
    ["-1,500", { maxDecimals: 4, allowNegative: true }, -1500],
  ] as const)("flags %j with %j as ambiguous, suggesting %d", (input, options, suggestion) => {
    expect(parseMoneyInputDetailed(input, options)).toEqual({ value: null, error: "ambiguous", suggestion });
  });

  it.each([
    ["", "empty"],
    ["abc", "invalid"],
    ["-5", "negative"],
    ["1,234", "ambiguous"],
    ["12,345", "ambiguous"],
    ["1,2345", "tooManyDecimals"],
    ["0150", null],
    ["1.500.000", null],
  ] as const)("reports %j as %j", (input, error) => {
    expect(parseMoneyInputDetailed(input).error).toBe(error);
  });

  it("reads a grouped million with dots (the fr/vi habit) as a million", () => {
    expect(parseMoneyInput("1.500.000")).toBe(1500000);
  });
});

describe("formatMoneyInput", () => {
  it.each([
    [12500.5, "fr", { minDecimals: 2 }, "12500,50"],
    [12500, "fr", { minDecimals: 2 }, "12500"],
    [8.99, "vi", {}, "8,99"],
    [5.5, "en", {}, "5.5"],
    [1.2345, "fr", {}, "1,2345"],
    [49.66000000000001, "fr", { maxDecimals: 2 }, "49,66"],
    [-8.45, "fr", {}, "-8,45"],
    // Three decimals get a fourth so the text never reads as "1 859" grouped.
    [1.859, "fr", {}, "1,8590"],
    [-2.375, "en", {}, "-2.3750"],
    [null, "fr", {}, ""],
  ] as const)("formats %d in %s (%j) as %j, which parses back", (value, locale, options, text) => {
    const out = formatMoneyInput(value, locale, options);
    expect(out).toBe(text);
    if (value !== null) {
      expect(parseMoneyInput(out, { maxDecimals: 4, allowNegative: true })).toBe(
        Number(value.toFixed(options && "maxDecimals" in options ? options.maxDecimals : 4))
      );
    }
  });
});
