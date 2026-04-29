/**
 * i18n parity tests for labor.export namespace — phase 05
 *
 * Asserts that en/fr/vi all carry identical key sets under labor.export,
 * and that each new phase-05 key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

// ── Key extraction ────────────────────────────────────────────────────────────

const enKeys = Object.keys(en.labor.export).sort();
const frKeys = Object.keys(fr.labor.export).sort();
const viKeys = Object.keys(vi.labor.export).sort();

// ── Parity tests ──────────────────────────────────────────────────────────────

describe("labor.export i18n parity — key sets", () => {
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

// ── Phase-05 new keys — presence and non-empty ────────────────────────────────

const PHASE_05_KEYS = [
  "workerDialogTitle",
  "workerSubtitle",
  "exportWorker",
  "workerToastSuccess",
  "workerToastError",
] as const;

type ExportKey = keyof typeof en.labor.export;

describe("labor.export i18n parity — phase-05 keys present and non-empty", () => {
  for (const key of PHASE_05_KEYS) {
    it(`en.labor.export.${key} exists and is non-empty`, () => {
      const value = en.labor.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.labor.export.${key} exists and is non-empty`, () => {
      const value = fr.labor.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.labor.export.${key} exists and is non-empty`, () => {
      const value = vi.labor.export[key as ExportKey];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});
