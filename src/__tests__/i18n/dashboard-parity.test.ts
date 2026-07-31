/**
 * dashboard-parity.test.ts
 *
 * Asserts that en.json, fr.json, and vi.json have identical key trees under:
 *   - dashboard.*
 *
 * Also asserts no empty-string values exist under that namespace.
 */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively extract all leaf key paths from an object. */
function flatKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

/** Recursively find all leaf values (as [path, value] tuples). */
function flatEntries(obj: unknown, prefix = ""): [string, unknown][] {
  if (obj === null || typeof obj !== "object") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatEntries(v, prefix ? `${prefix}.${k}` : k)
  );
}

/** Extract sub-object by dot-separated key path. */
function dig(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ---------------------------------------------------------------------------
// Namespaces to check
// ---------------------------------------------------------------------------

const NAMESPACES = ["dashboard"] as const;

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("i18n dashboard key parity", () => {
  for (const ns of NAMESPACES) {
    describe(`namespace: ${ns}`, () => {
      const keysByLocale = LOCALES.map(({ name, messages }) => ({
        name,
        keys: new Set(flatKeys(dig(messages, ns))),
      }));

      const [enLocale, ...rest] = keysByLocale;

      it("all locales have the same keys as en", () => {
        for (const locale of rest) {
          const missing = [...enLocale.keys].filter((k) => !locale.keys.has(k));
          const extra = [...locale.keys].filter((k) => !enLocale.keys.has(k));
          expect(missing, `${locale.name} is missing keys: ${missing.join(", ")}`).toHaveLength(0);
          expect(extra, `${locale.name} has extra keys: ${extra.join(", ")}`).toHaveLength(0);
        }
      });

      it("no empty-string values in any locale", () => {
        for (const { name, messages } of LOCALES) {
          const entries = flatEntries(dig(messages, ns));
          const empties = entries.filter(([, v]) => v === "").map(([k]) => k);
          expect(empties, `${name} has empty values at: ${empties.join(", ")}`).toHaveLength(0);
        }
      });
    });
  }
});
