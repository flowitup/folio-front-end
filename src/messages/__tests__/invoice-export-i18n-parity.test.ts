/**
 * i18n parity tests for invoices.export namespace — phase 06
 *
 * Asserts that en/fr/vi all carry identical key sets under invoices.export,
 * and that each phase-06 key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// ── Required keys ─────────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  "trigger", "dialogTitle", "from", "to",
  "typeFilter", "typeAll", "typeClient", "typeLabor", "typeSupplier",
  "format", "xlsx", "pdf", "download", "cancel",
  "generating", "downloaded", "summaryLine",
  "errorRangeInvalid", "errorRangeTooLarge", "errorGeneric",
] as const;

// ── Parity tests — key sets ───────────────────────────────────────────────────

const enKeys = Object.keys(en.invoices.export).sort();
const frKeys = Object.keys(fr.invoices.export).sort();
const viKeys = Object.keys(vi.invoices.export).sort();

describe("invoices.export i18n parity — key sets", () => {
  it("fr has the same keys as en", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("vi has the same keys as en", () => {
    expect(viKeys).toEqual(enKeys);
  });

  it("all three locales share identical sorted key arrays", () => {
    expect(frKeys).toEqual(enKeys);
    expect(viKeys).toEqual(enKeys);
    expect(frKeys).toEqual(viKeys);
  });
});

// ── Phase-06 keys — presence and non-empty ────────────────────────────────────

type ExportKey = keyof typeof en.invoices.export;

describe("invoices.export i18n parity — phase-06 keys present and non-empty", () => {
  for (const key of REQUIRED_KEYS) {
    it(`en.invoices.export.${key} exists and is non-empty`, () => {
      const value = en.invoices.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.invoices.export.${key} exists and is non-empty`, () => {
      const value = fr.invoices.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.invoices.export.${key} exists and is non-empty`, () => {
      const value = vi.invoices.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
