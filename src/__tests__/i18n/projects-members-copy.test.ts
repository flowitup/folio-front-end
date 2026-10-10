/**
 * projects-members-copy.test.ts
 *
 * Project and member strings that used to mislead:
 *   - projects.budgetInvalid said "must be a positive number" for a positive
 *     but ambiguous "12,500"; it now shows the accepted format, and every
 *     example it gives must be one the parser reads;
 *   - members.edit.emailHint called the e-mail the sign-in identity, while
 *     sign-in is by phone code only;
 *   - the keys added for those fixes exist in every locale.
 */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";

const LOCALES = { en, fr, vi } as const;

describe.each(Object.entries(LOCALES))("%s", (_locale, messages) => {
  it("gives budget examples the money parser accepts", () => {
    const examples = messages.projects.budgetInvalid.match(/\d[\d .,]*\d/g) ?? [];
    expect(examples.length).toBeGreaterThanOrEqual(2);
    for (const example of examples) {
      expect(parseMoneyInput(example)).toBe(12500);
    }
  });

  it("does not present the e-mail as the sign-in identity", () => {
    const hint = messages.members.edit.emailHint;
    expect(hint).toMatch(/phone|téléphone|điện thoại/);
    expect(hint).not.toMatch(/login identity|identifiant de connexion|danh tính đăng nhập/);
  });

  it("has the project-updated toast and the labelled invitation values", () => {
    expect(messages.projects.projectUpdated).toBeTruthy();
    expect(messages.members.expiresInLabeled).toContain("{days");
    expect(messages.members.invitedByName).toContain("{name}");
  });
});
