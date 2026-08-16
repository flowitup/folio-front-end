/**
 * i18n parity test for the 'analyses' feature
 * Asserts that analyses message keys are identical across en.json, fr.json, vi.json
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
      // Recurse into nested objects
      keys.push(...getAllKeys(value, fullKey));
    } else {
      // Leaf node
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

// ---- Extract analyses keys ----

const enAnalyses = (enMessages.analyses as unknown) || {};
const frAnalyses = (frMessages.analyses as unknown) || {};
const viAnalyses = (viMessages.analyses as unknown) || {};

const enKeys = getAllKeys(enAnalyses);
const frKeys = getAllKeys(frAnalyses);
const viKeys = getAllKeys(viAnalyses);

// ---- Tests ----

describe("i18n parity: analyses keys", () => {
  it("en.json has 'analyses' key", () => {
    expect(enMessages).toHaveProperty("analyses");
  });

  it("fr.json has 'analyses' key", () => {
    expect(frMessages).toHaveProperty("analyses");
  });

  it("vi.json has 'analyses' key", () => {
    expect(viMessages).toHaveProperty("analyses");
  });

  it("all three languages have identical key sets", () => {
    expect(frKeys).toEqual(enKeys);
    expect(viKeys).toEqual(enKeys);
  });

  it("en and fr key sets match", () => {
    const enOnly = enKeys.filter((k) => !frKeys.includes(k));
    const frOnly = frKeys.filter((k) => !enKeys.includes(k));

    if (enOnly.length > 0 || frOnly.length > 0) {
      throw new Error(`Key mismatch between en and fr:
en only: ${enOnly.join(", ")}
fr only: ${frOnly.join(", ")}`);
    }

    expect(enOnly.length).toBe(0);
    expect(frOnly.length).toBe(0);
  });

  it("en and vi key sets match", () => {
    const enOnly = enKeys.filter((k) => !viKeys.includes(k));
    const viOnly = viKeys.filter((k) => !enKeys.includes(k));

    if (enOnly.length > 0 || viOnly.length > 0) {
      throw new Error(`Key mismatch between en and vi:
en only: ${enOnly.join(", ")}
vi only: ${viOnly.join(", ")}`);
    }

    expect(enOnly.length).toBe(0);
    expect(viOnly.length).toBe(0);
  });

  it("fr and vi key sets match", () => {
    const frOnly = frKeys.filter((k) => !viKeys.includes(k));
    const viOnly = viKeys.filter((k) => !frKeys.includes(k));

    if (frOnly.length > 0 || viOnly.length > 0) {
      throw new Error(`Key mismatch between fr and vi:
fr only: ${frOnly.join(", ")}
vi only: ${viOnly.join(", ")}`);
    }

    expect(frOnly.length).toBe(0);
    expect(viOnly.length).toBe(0);
  });

  it("all languages have the expected analyses subkeys", () => {
    const expectedTopLevel = [
      "card",
      "delete",
      "edit",
      "empty",
      "errors",
      "filter",
      "pagination",
      "search",
      "title",
      "toast",
      "upload",
      "viewer",
    ];

    for (const key of expectedTopLevel) {
      const fullKey = key;
      expect(enKeys.some((k) => k.startsWith(fullKey))).toBe(true);
      expect(frKeys.some((k) => k.startsWith(fullKey))).toBe(true);
      expect(viKeys.some((k) => k.startsWith(fullKey))).toBe(true);
    }
  });

  it("no keys are empty strings or null", () => {
    const checkEmpty = (keys: string[], lang: string) => {
      const empty = keys.filter((k) => !k || k.trim() === "");
      if (empty.length > 0) {
        throw new Error(`${lang} has empty keys: ${empty.join(", ")}`);
      }
    };

    checkEmpty(enKeys, "en");
    checkEmpty(frKeys, "fr");
    checkEmpty(viKeys, "vi");
  });
});
