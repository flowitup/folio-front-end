/**
 * assistant-audit-i18n-parity.test.ts
 *
 * The `assistantAudit` namespace backs the company-admin supervision page — Vietnamese
 * is a real audience here too, not a placeholder locale, so this pins the same nested
 * key set across en/fr/vi, that no value is blank, and that values were actually
 * translated rather than copy-pasted from English. Also pins the `companySettings`
 * link label that opens the page from Settings › Company.
 */

import { describe, it, expect } from "vitest";

import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

function getAllKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

type Messages = Record<string, unknown>;

const locales: Record<string, Messages> = {
  en: en as unknown as Messages,
  fr: fr as unknown as Messages,
  vi: vi as unknown as Messages,
};

// The em dash reads the same in every locale by design (a "no value" marker, not text).
const SHARED_BY_DESIGN = new Set(["noCost"]);

describe("assistantAudit i18n", () => {
  it("defines the namespace in every locale", () => {
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.assistantAudit, `${name}.json is missing the assistantAudit namespace`).toBeDefined();
    }
  });

  it("carries an identical nested key set across en/fr/vi", () => {
    const enKeys = getAllKeys(locales.en.assistantAudit);
    expect(enKeys.length).toBeGreaterThan(10);
    expect(getAllKeys(locales.fr.assistantAudit)).toEqual(enKeys);
    expect(getAllKeys(locales.vi.assistantAudit)).toEqual(enKeys);
  });

  it("has no blank value", () => {
    for (const [name, messages] of Object.entries(locales)) {
      const flat = messages.assistantAudit as Record<string, unknown>;
      for (const key of getAllKeys(flat)) {
        const value = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], flat);
        expect(typeof value, `${name}.assistantAudit.${key}`).toBe("string");
        expect((value as string).trim().length, `${name}.assistantAudit.${key} is blank`).toBeGreaterThan(0);
      }
    }
  });

  it("was actually translated, not copied from English", () => {
    const keys = getAllKeys(locales.en.assistantAudit);
    const read = (messages: Messages, key: string): unknown =>
      key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], messages.assistantAudit);
    const copied = keys.filter(
      (key) => !SHARED_BY_DESIGN.has(key) && read(locales.en, key) === read(locales.fr, key) && read(locales.en, key) === read(locales.vi, key)
    );
    expect(copied).toEqual([]);
  });

  it("names the link to the page from Settings › Company in every locale", () => {
    for (const [name, messages] of Object.entries(locales)) {
      const companySettings = messages.companySettings as Record<string, string>;
      expect(companySettings.assistantAuditLink, `${name}.companySettings.assistantAuditLink`).toBeTruthy();
    }
    const fr_ = (locales.fr.companySettings as Record<string, string>).assistantAuditLink;
    const vi_ = (locales.vi.companySettings as Record<string, string>).assistantAuditLink;
    const en_ = (locales.en.companySettings as Record<string, string>).assistantAuditLink;
    expect(vi_).not.toBe(en_);
    expect(fr_).not.toBe(en_);
  });
});
