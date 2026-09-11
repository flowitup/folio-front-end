/**
 * help-i18n-parity.test.ts
 *
 * The panel's chrome (title, back control, section labels) lives in the message files; the
 * workflow prose itself lives in `src/content/help` and is covered by its own parity test.
 * This checks the three locales carry the same chrome keys, that none is blank, and that the
 * values were actually translated rather than copy-pasted from English.
 */

import { describe, expect, it } from "vitest";

import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

type Nested = Record<string, unknown>;

const locales: Record<string, Nested> = {
  en: en as unknown as Nested,
  fr: fr as unknown as Nested,
  vi: vi as unknown as Nested,
};

/** Dotted key paths, so the nested `aria.*` entries are compared too. */
function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (typeof value !== "object" || value === null) return {};
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key)
    )
  );
}

const help = Object.fromEntries(
  Object.entries(locales).map(([name, messages]) => [name, flatten(messages.help)])
);

describe("help i18n", () => {
  it("defines the namespace in every locale", () => {
    for (const [name, messages] of Object.entries(locales)) {
      expect(messages.help, `${name}.json is missing the help namespace`).toBeDefined();
    }
  });

  it("carries an identical key set across en/fr/vi", () => {
    expect(Object.keys(help.fr).sort()).toEqual(Object.keys(help.en).sort());
    expect(Object.keys(help.vi).sort()).toEqual(Object.keys(help.en).sort());
  });

  it("has no blank value", () => {
    for (const [name, entries] of Object.entries(help)) {
      for (const [key, value] of Object.entries(entries)) {
        expect(value.trim().length, `${name}.help.${key} is blank`).toBeGreaterThan(0);
      }
    }
  });

  it.each(["fr", "vi"])(
    "%s was actually translated, not copied from English",
    (locale) => {
      const copied = Object.keys(help.en).filter(
        (key) => help.en[key] === help[locale][key]
      );
      expect(copied).toEqual([]);
    }
  );
});
