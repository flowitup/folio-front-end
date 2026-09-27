/**
 * i18n parity for labor.role — the role picker and the Settings › Company ›
 * Labor roles card.
 *
 * Asserts en/fr/vi carry the same key tree under labor.role, that every
 * string is non-empty, and that the copy the rename/delete flow added is
 * actually translated rather than pasted English.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

function flatEntries(obj: unknown, prefix = ""): [string, unknown][] {
  if (obj === null || typeof obj !== "object") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatEntries(v, prefix ? `${prefix}.${k}` : k)
  );
}

const LOCALES = { en, fr, vi } as const;
const entries = (locale: keyof typeof LOCALES) =>
  new Map(flatEntries(LOCALES[locale].labor.role));

/** Keys the rename / delete flow reads. */
const MANAGE_KEYS = [
  "editRole",
  "deleteRole",
  "confirmDelete",
  "confirmDeleteTitle",
  "updated",
  "deleted",
  "save",
  "nameRequired",
  "editNamed",
  "deleteNamed",
  "updateFailed",
  "deleteFailed",
  "loadFailed",
  "retry",
  "manageTitle",
  "manageDescription",
  "errors.forbidden",
  "errors.notFound",
  "errors.rateLimited",
  "errors.invalid",
] as const;

describe("labor.role i18n parity", () => {
  it("fr and vi have exactly the en key tree", () => {
    const enKeys = [...entries("en").keys()].sort();
    expect([...entries("fr").keys()].sort()).toEqual(enKeys);
    expect([...entries("vi").keys()].sort()).toEqual(enKeys);
  });

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
    "%s has a non-empty string for every rename/delete key",
    (locale) => {
      const map = entries(locale);
      for (const key of MANAGE_KEYS) {
        const value = map.get(key);
        expect(typeof value, `${locale}: labor.role.${key}`).toBe("string");
        expect((value as string).trim().length, `${locale}: labor.role.${key}`).toBeGreaterThan(0);
      }
    }
  );

  it("fr and vi translate the new copy instead of repeating English", () => {
    const enMap = entries("en");
    for (const locale of ["fr", "vi"] as const) {
      const map = entries(locale);
      for (const key of MANAGE_KEYS) {
        expect(map.get(key), `${locale}: labor.role.${key}`).not.toBe(enMap.get(key));
      }
    }
  });

  it("keeps the {name} placeholder in every locale", () => {
    for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      const map = entries(locale);
      for (const key of ["editNamed", "deleteNamed", "confirmDeleteTitle"]) {
        expect(map.get(key), `${locale}: labor.role.${key}`).toContain("{name}");
      }
    }
  });
});
