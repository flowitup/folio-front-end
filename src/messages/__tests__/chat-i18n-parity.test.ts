/**
 * i18n parity for the `chat` namespace: en/fr/vi must expose the same keys
 * (Vietnamese is a real audience).
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

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

const messagesDir = path.join(__dirname, "..");
const load = (lang: string) =>
  JSON.parse(fs.readFileSync(path.join(messagesDir, `${lang}.json`), "utf-8")) as Record<
    string,
    Record<string, unknown>
  >;

const en = load("en");
const fr = load("fr");
const vi = load("vi");

describe("chat i18n parity", () => {
  it("has the same chat keys in en, fr and vi", () => {
    const enKeys = getAllKeys(en.chat);
    expect(enKeys.length).toBeGreaterThan(10);
    expect(getAllKeys(fr.chat)).toEqual(enKeys);
    expect(getAllKeys(vi.chat)).toEqual(enKeys);
  });

  it("uses ICU plural syntax for counts (next-intl), not i18next _one/_other keys", () => {
    for (const messages of [en, fr, vi]) {
      const chat = messages.chat as Record<string, string>;
      expect(chat.membersCount).toMatch(/\{count, plural,/);
      expect(chat.unread).toMatch(/\{count, plural,/);
      expect(chat.membersCount_one).toBeUndefined();
    }
  });
});
