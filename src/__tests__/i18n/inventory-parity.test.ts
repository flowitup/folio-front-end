/**
 * inventory-parity.test.ts
 *
 * Asserts that en.json, fr.json, and vi.json have identical key trees under
 * `inventory.*`, that `navigation.inventory` and the D8 grant label for
 * `inventory:manage` exist in every locale, and that no value is blank.
 */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

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
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

describe("i18n inventory parity", () => {
  const enKeys = new Set(flatKeys(dig(en as Record<string, unknown>, "inventory")));

  it("en has the inventory namespace", () => {
    expect(enKeys.size).toBeGreaterThan(0);
  });

  for (const locale of LOCALES.filter((l) => l.name !== "en")) {
    it(`${locale.name} has the same inventory key tree as en`, () => {
      const localeKeys = new Set(flatKeys(dig(locale.messages, "inventory")));
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));
      expect(missing, `Keys in en but missing in ${locale.name}`).toEqual([]);
      expect(extra, `Extra keys in ${locale.name} not in en`).toEqual([]);
    });
  }

  for (const locale of LOCALES) {
    it(`${locale.name} has no empty inventory values`, () => {
      const empties = flatEntries(dig(locale.messages, "inventory"))
        .filter(([, v]) => v === "")
        .map(([k]) => `inventory.${k}`);
      expect(empties).toEqual([]);
    });

    it(`${locale.name} names the sidebar entry and the grant label`, () => {
      for (const key of ["navigation.inventory", "companySettings.grants.permission.inventory_manage"]) {
        const val = dig(locale.messages, key);
        expect(val, `${key} missing in ${locale.name}`).toBeTruthy();
        expect(typeof val).toBe("string");
      }
    });
  }
});
