/**
 * i18n parity for the 'admin.bulkAdd' namespace (platform-ops bulk-add form).
 *
 * This namespace had drifted from the UI twice over: it still described a role
 * picker the form had stopped rendering, and it carried no message for an error
 * code the server action could still return. These tests lock both down.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

type Messages = Record<string, unknown>;

const LOCALES: Record<string, Messages> = {
  en: en as unknown as Messages,
  fr: fr as unknown as Messages,
  vi: vi as unknown as Messages,
};

/** The namespace under test, for one locale. */
function bulkAdd(messages: Messages): Messages {
  return (messages.admin as Messages).bulkAdd as Messages;
}

/** Flatten a message object into sorted dotted leaf paths. */
function leafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...leafKeys(value, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

function resolve(obj: Messages, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Messages | undefined)?.[part], obj);
}

const keys: Record<string, string[]> = Object.fromEntries(
  Object.entries(LOCALES).map(([lang, messages]) => [lang, leafKeys(bulkAdd(messages))])
);

describe("i18n parity: admin.bulkAdd", () => {
  it("every locale carries the namespace", () => {
    for (const [lang, messages] of Object.entries(LOCALES)) {
      expect(messages.admin, `${lang}.json`).toHaveProperty("bulkAdd");
    }
  });

  it("all three locales carry identical key sets", () => {
    expect(keys.fr, "fr vs en").toEqual(keys.en);
    expect(keys.vi, "vi vs en").toEqual(keys.en);
  });

  it("every key resolves to a non-empty string in every locale", () => {
    for (const [lang, messages] of Object.entries(LOCALES)) {
      for (const key of keys.en) {
        const value = resolve(bulkAdd(messages), key);
        expect(typeof value, `${lang}: ${key}`).toBe("string");
        expect((value as string).trim(), `${lang}: ${key}`).not.toBe("");
      }
    }
  });

  it("every error code the bulk-add action can return has a message", () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "app",
        "[locale]",
        "(app)",
        "settings",
        "users",
        "actions.ts"
      ),
      "utf-8"
    );

    // The form renders whatever the action hands back through t(`errors.${key}`),
    // so a code with no message reaches the user as a raw key path. Codes that
    // get there come from classifyBackendError and bulkAddMembershipsAction,
    // both declared after searchUsersAction — whose own codes the search box
    // discards instead of translating.
    const surfaced = source.slice(source.indexOf("function classifyBackendError"));
    const codes = new Set(
      [...surfaced.matchAll(/(?:return|error:)\s*"([a-zA-Z]+)"/g)].map((m) => m[1])
    );

    expect(
      codes.size,
      "no error codes parsed — has actions.ts been reordered?"
    ).toBeGreaterThanOrEqual(5);

    for (const code of codes) {
      for (const [lang, messages] of Object.entries(LOCALES)) {
        expect(
          (bulkAdd(messages).errors as Messages)[code],
          `${lang}: admin.bulkAdd.errors.${code} is missing, but actions.ts can return it`
        ).toBeTruthy();
      }
    }
  });
});
