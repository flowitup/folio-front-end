/**
 * labor-parity.test.ts
 *
 * Asserts that en.json, fr.json, and vi.json have identical key trees under:
 *   - labor.*
 *   - notifications.*
 *
 * Also asserts no empty-string values exist under those namespaces, and that
 * the worker change-request strings are translated (not English copies).
 */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

// ---------------------------------------------------------------------------
// Helpers (same pattern as notes-parity.test.ts)
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

const NAMESPACES = ["labor", "notifications"] as const;

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("i18n labor + notifications parity", () => {
  for (const ns of NAMESPACES) {
    describe(`namespace: ${ns}`, () => {
      const enNode = dig(en as Record<string, unknown>, ns);
      const enKeys = new Set(flatKeys(enNode));

      it("en has at least one key", () => {
        expect(enKeys.size).toBeGreaterThan(0);
      });

      for (const locale of LOCALES.filter((l) => l.name !== "en")) {
        it(`${locale.name} has same key tree as en`, () => {
          const localeKeys = new Set(flatKeys(dig(locale.messages, ns)));
          const missing = [...enKeys].filter((k) => !localeKeys.has(k));
          const extra = [...localeKeys].filter((k) => !enKeys.has(k));

          expect(missing, `Keys in en but missing in ${locale.name}`).toEqual([]);
          expect(extra, `Extra keys in ${locale.name} not in en`).toEqual([]);
        });
      }

      for (const locale of LOCALES) {
        it(`${locale.name} has no empty-string values`, () => {
          const empties = flatEntries(dig(locale.messages, ns))
            .filter(([, v]) => v === "")
            .map(([k]) => `${ns}.${k}`);
          expect(empties, `Empty strings in ${locale.name}`).toEqual([]);
        });
      }
    });
  }

  describe("worker change-request strings are translated", () => {
    const PATHS = [
      "labor.changeRequest",
      "notifications.attendance.changeTitle",
      "notifications.attendance.applyChange",
      "notifications.attendance.refuseChange",
      "notifications.attendance.changeApplied",
      "notifications.attendance.changeRefused",
      "notifications.errors.applyChangeFailed",
      "notifications.errors.refuseChangeFailed",
    ];

    for (const path of PATHS) {
      const enValues = new Map(flatEntries(dig(en as Record<string, unknown>, path)));
      for (const locale of LOCALES.filter((l) => l.name !== "en")) {
        it(`${locale.name} does not copy the English text of ${path}`, () => {
          const copies = flatEntries(dig(locale.messages, path))
            .filter(([k, v]) => v === enValues.get(k))
            .map(([k]) => (k ? `${path}.${k}` : path));
          expect(copies, `English copies in ${locale.name}`).toEqual([]);
        });
      }
    }
  });
});
