/**
 * The 8-character code a member types to join a company has one name in each
 * language: settings, onboarding, the error and the help all use it (and the
 * mobile app calls it the same).
 */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";
import { helpCatalogueEn } from "@/content/help/en";
import { helpCatalogueFr } from "@/content/help/fr";
import { helpCatalogueVi } from "@/content/help/vi";

const CASES = [
  { messages: en, help: helpCatalogueEn, name: /company code/i, other: /join code/i },
  { messages: fr, help: helpCatalogueFr, name: /code entreprise/i, other: /code d'adhésion|code société/i },
  { messages: vi, help: helpCatalogueVi, name: /mã công ty/i, other: /mã tham gia/i },
];

describe("company code naming", () => {
  it.each(CASES)("settings, onboarding and errors agree ($name)", ({ messages, help, name, other }) => {
    expect(messages.companies.admin.manage.joinCode.title).toMatch(name);
    expect(messages.onboarding.join.codeLabel).toMatch(name);
    expect(messages.onboarding.joinCompanyCta).toMatch(name);
    expect(messages.companies.errors.invalidJoinCode).toMatch(name);
    expect(JSON.stringify(messages)).not.toMatch(other);
    expect(JSON.stringify(help)).not.toMatch(other);
  });

  it("French calls a company an 'entreprise' everywhere, never a 'société'", () => {
    expect(JSON.stringify(fr)).not.toMatch(/société/i);
    expect(JSON.stringify(helpCatalogueFr)).not.toMatch(/société/i);
  });
});
