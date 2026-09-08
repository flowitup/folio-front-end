/**
 * roles-permissions-i18n-parity.test.ts
 *
 * Whole-file parity guard for the roles-permissions-redesign i18n additions
 * (onboarding, companySettings, members.assign, labor.roster,
 * notifications.companyEvents, billing.templates.companyLabel,
 * companies.admin.manage.attached.roleManager, settings.company) — and, since
 * it walks the entire message tree rather than one namespace, doubles as a
 * standing guard against future drift anywhere else in the three files.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

function flatKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

const LOCALES = [
  { name: "en", messages: en as Record<string, unknown> },
  { name: "fr", messages: fr as Record<string, unknown> },
  { name: "vi", messages: vi as Record<string, unknown> },
];

describe("i18n whole-file parity (en/fr/vi)", () => {
  const enKeys = new Set(flatKeys(en as Record<string, unknown>));

  it("en has keys", () => {
    expect(enKeys.size).toBeGreaterThan(0);
  });

  for (const locale of LOCALES.filter((l) => l.name !== "en")) {
    it(`${locale.name} has the identical key tree as en`, () => {
      const localeKeys = new Set(flatKeys(locale.messages));
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));
      expect(missing, `Keys in en but missing in ${locale.name}`).toEqual([]);
      expect(extra, `Extra keys in ${locale.name} not in en`).toEqual([]);
    });
  }

  // Spot-check the new namespaces this phase introduced actually landed in
  // every locale (a real regression here would also fail the key-tree
  // comparisons above, but this pins the exact paths for a clearer failure).
  const NEW_NAMESPACE_KEYS = [
    "onboarding.title",
    "onboarding.createCompanyCta",
    "onboarding.joinCompanyCta",
    "companySettings.members.title",
    "companySettings.grants.dialogTitle",
    "companySettings.addByPhone.dialogTitle",
    "companySettings.import.dialogTitle",
    "companySettings.directory.title",
    "members.assign.button",
    "labor.roster.title",
    "notifications.companyEvents.title",
    "projects.waitingForAssignment.title",
    "billing.templates.companyLabel",
    "settings.company.title",
  ];

  function dig(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }

  for (const locale of LOCALES) {
    it(`${locale.name} defines every new roles-permissions-redesign key`, () => {
      const missing = NEW_NAMESPACE_KEYS.filter((path) => dig(locale.messages, path) === undefined);
      expect(missing, `Missing in ${locale.name}`).toEqual([]);
    });
  }
});
