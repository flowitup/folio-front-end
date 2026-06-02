/**
 * tags-parity.test.ts
 *
 * Asserts that en.json, fr.json, and vi.json have identical key trees under:
 *   - tags.*
 *   - navigation.tags (single key added to navigation namespace)
 *
 * Also asserts no empty-string values exist under those namespaces.
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

const NAMESPACES = ["tags"] as const;

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("i18n tags parity", () => {
  for (const ns of NAMESPACES) {
    describe(`namespace: ${ns}`, () => {
      const enNode = dig(en as Record<string, unknown>, ns);
      const enKeys = new Set(flatKeys(enNode));

      it("en has at least one key", () => {
        expect(enKeys.size).toBeGreaterThan(0);
      });

      for (const locale of LOCALES.filter((l) => l.name !== "en")) {
        it(`${locale.name} has same key tree as en`, () => {
          const localeNode = dig(locale.messages, ns);
          const localeKeys = new Set(flatKeys(localeNode));

          const missing = [...enKeys].filter((k) => !localeKeys.has(k));
          const extra = [...localeKeys].filter((k) => !enKeys.has(k));

          expect(missing, `Keys in en but missing in ${locale.name}`).toEqual([]);
          expect(extra, `Extra keys in ${locale.name} not in en`).toEqual([]);
        });
      }

      for (const locale of LOCALES) {
        it(`${locale.name} has no empty-string values`, () => {
          const localeNode = dig(locale.messages, ns);
          const entries = flatEntries(localeNode);
          const empties = entries
            .filter(([, v]) => v === "")
            .map(([k]) => `${ns}.${k}`);
          expect(empties, `Empty strings in ${locale.name}`).toEqual([]);
        });
      }
    });
  }

  // Verify navigation.tags key is present in all locales
  describe("navigation.tags key", () => {
    for (const locale of LOCALES) {
      it(`${locale.name} has navigation.tags`, () => {
        const val = dig(locale.messages, "navigation.tags");
        expect(val, `navigation.tags missing in ${locale.name}`).toBeTruthy();
        expect(typeof val).toBe("string");
      });
    }
  });
});
