/**
 * i18n parity for the project form keys introduced when the address became the
 * mandatory, leading field and the name an optional label.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const KEYS = [
  "projectAddress",
  "projectAddressPlaceholder",
  "projectNameOptional",
  "projectNamePlaceholder",
  "createProjectAddressRequired",
  "editProjectAddressRequired",
] as const;

const REMOVED_KEYS = ["projectName", "projectAddressOptional", "createProjectNameRequired", "editProjectNameRequired"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const locales = { en: (en as any).projects, fr: (fr as any).projects, vi: (vi as any).projects } as Record<
  string,
  Record<string, unknown>
>;

describe("projects address-required i18n parity", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    for (const key of KEYS) {
      it(`${locale}.projects.${key} exists and is non-empty`, () => {
        const value = messages[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    }

    for (const key of REMOVED_KEYS) {
      it(`${locale}.projects.${key} is gone`, () => {
        expect(messages[key]).toBeUndefined();
      });
    }
  }

  it("fr and vi labels differ from en", () => {
    expect(locales.fr.projectAddress).not.toBe(locales.en.projectAddress);
    expect(locales.vi.projectAddress).not.toBe(locales.en.projectAddress);
  });
});
