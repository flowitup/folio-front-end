/**
 * parseMoneyInput must read fr/vi/en amounts exactly, and reject anything it
 * cannot read unambiguously instead of truncating it like parseFloat does.
 */

import { describe, it, expect } from "vitest";
import { parseMoneyInput } from "../parse-money-input";

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
    ["1,859", { maxDecimals: 4 }, 1.859],
    ["2,375", { maxDecimals: 3 }, 2.375],
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
