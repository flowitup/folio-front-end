/**
 * companies-parity.test.ts
 *
 * Required regression test:
 *   test_companies_i18n_parity
 *
 * Asserts that en.json, fr.json, and vi.json have identical key trees under
 * the "companies" namespace, and that no locale has empty-string values.
 *
 * This test is intentionally separate from billing-parity.test.ts because
 * the billing-parity test already covers the "companies" namespace as part of
 * a broader check. This file provides a focused, named regression entry point
 * for the phase-10 requirement.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

// ---------------------------------------------------------------------------
// Helpers (same pattern as billing-parity.test.ts)
// ---------------------------------------------------------------------------

function flatKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

function flatEntries(obj: unknown, prefix = ""): [string, unknown][] {
  if (obj === null || typeof obj !== "object") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatEntries(v, prefix ? `${prefix}.${k}` : k)
  );
}

function dig(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ---------------------------------------------------------------------------
// Locale registry
// ---------------------------------------------------------------------------

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

const NS = "companies";

// ---------------------------------------------------------------------------
// test_companies_i18n_parity
// ---------------------------------------------------------------------------

describe("test_companies_i18n_parity", () => {
  const enNode = dig(en as Record<string, unknown>, NS);
  const enKeys = new Set(flatKeys(enNode));

  it("en has at least one key under companies", () => {
    expect(enKeys.size).toBeGreaterThan(0);
  });

  it("en has companies.picker sub-namespace", () => {
    expect(dig(en as Record<string, unknown>, "companies.picker")).toBeDefined();
  });

  it("en has companies.picker.label (wired in Step 0)", () => {
    const val = dig(en as Record<string, unknown>, "companies.picker.label");
    expect(typeof val).toBe("string");
    expect((val as string).length).toBeGreaterThan(0);
  });

  it("en has companies.picker.noCompaniesCalloutTitle (wired in Step 0)", () => {
    const val = dig(en as Record<string, unknown>, "companies.picker.noCompaniesCalloutTitle");
    expect(typeof val).toBe("string");
    expect((val as string).length).toBeGreaterThan(0);
  });

  for (const locale of LOCALES.filter((l) => l.name !== "en")) {
    it(`${locale.name} has same key tree as en under companies`, () => {
      const localeNode = dig(locale.messages, NS);
      const localeKeys = new Set(flatKeys(localeNode));

      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));

      expect(missing, `Keys in en missing from ${locale.name}`).toEqual([]);
      expect(extra, `Extra keys in ${locale.name} not in en`).toEqual([]);
    });
  }

  for (const locale of LOCALES) {
    it(`${locale.name} has no empty-string values under companies`, () => {
      const localeNode = dig(locale.messages, NS);
      const entries = flatEntries(localeNode);
      const empties = entries
        .filter(([, v]) => v === "")
        .map(([k]) => `${NS}.${k}`);
      expect(empties, `Empty strings in ${locale.name}`).toEqual([]);
    });
  }
});
