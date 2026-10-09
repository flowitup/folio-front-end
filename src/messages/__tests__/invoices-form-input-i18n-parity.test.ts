/**
 * i18n parity for the expense form's line-figure, date-range and attachment
 * rename messages: present and non-empty in en/fr/vi, with the same ICU
 * placeholders in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const FORM_KEYS = [
  "errorQuantityInvalid",
  "errorUnitPriceInvalid",
  "errorUnitPriceNegative",
  "errorVatRateInvalid",
  "errorDateOutOfRange",
] as const;

const LOCALES = { en, fr, vi } as const;

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

function message(locale: keyof typeof LOCALES, path: string[]): string | undefined {
  let node: unknown = LOCALES[locale];
  for (const part of path) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : undefined;
}

const PATHS = [
  ...FORM_KEYS.map((key) => ["invoices", key]),
  ["invoices", "attachmentRename", "errorTooLong"],
];

describe("expense form input messages — i18n parity", () => {
  for (const path of PATHS) {
    it(`${path.join(".")} exists in every locale with the same placeholders`, () => {
      const reference = message("en", path);
      expect(reference?.trim()).toBeTruthy();
      for (const locale of ["fr", "vi"] as const) {
        const value = message(locale, path);
        expect(value?.trim()).toBeTruthy();
        expect(value).not.toBe(reference);
        expect(placeholders(value!)).toEqual(placeholders(reference!));
      }
    });
  }
});
