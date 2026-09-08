/**
 * i18n parity test for the 'documents' feature
 * Asserts that documents message keys are identical across en.json, fr.json, vi.json
 * (the "restricted" panel shown to callers without project:update included).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---- Helpers ----

function getAllKeys(obj: unknown, prefix = ""): string[] {
  const keys: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    return keys;
  }

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = (obj as Record<string, unknown>)[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys.sort();
}

// ---- Load message files ----

const messagesDir = path.join(__dirname, "..");

function loadMessageFile(lang: string): Record<string, unknown> {
  const filePath = path.join(messagesDir, `${lang}.json`);
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

const enMessages = loadMessageFile("en");
const frMessages = loadMessageFile("fr");
const viMessages = loadMessageFile("vi");

const enKeys = getAllKeys(enMessages.documents ?? {});
const frKeys = getAllKeys(frMessages.documents ?? {});
const viKeys = getAllKeys(viMessages.documents ?? {});

// ---- Tests ----

describe("i18n parity: documents keys", () => {
  it("all three languages have identical key sets", () => {
    expect(frKeys).toEqual(enKeys);
    expect(viKeys).toEqual(enKeys);
  });

  it("carries the restricted-access panel copy in every language", () => {
    for (const keys of [enKeys, frKeys, viKeys]) {
      expect(keys).toContain("restricted.title");
      expect(keys).toContain("restricted.body");
    }
  });

  it("has no empty translation values", () => {
    for (const messages of [enMessages, frMessages, viMessages]) {
      const docs = (messages.documents ?? {}) as Record<string, unknown>;
      const walk = (node: unknown) => {
        if (typeof node === "string") {
          expect(node.trim().length).toBeGreaterThan(0);
          return;
        }
        if (typeof node === "object" && node !== null) {
          for (const value of Object.values(node)) walk(value);
        }
      };
      walk(docs);
    }
  });
});
