/**
 * The invitation error screen has no project to name, so its heading must not
 * reuse the success title and leak a raw "{projectName}" placeholder.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi_ from "@/messages/vi.json";

const MESSAGES = { en, fr, vi: vi_ } as const;
let currentLocale: keyof typeof MESSAGES = "en";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: currentLocale,
      messages: MESSAGES[currentLocale] as never,
      namespace: namespace as never,
    }),
}));

import { InviteError } from "../invite-error";

describe("InviteError", () => {
  for (const locale of ["en", "fr", "vi"] as const) {
    for (const reason of ["expired", "revoked", "accepted", "not_found"] as const) {
      it(`shows a filled-in heading for ${reason} in ${locale}`, async () => {
        currentLocale = locale;
        render(await InviteError({ reason, locale }));
        const heading = screen.getByText(MESSAGES[locale].acceptInvite.errors.title);
        expect(heading).toBeInTheDocument();
        expect(document.body.textContent).not.toContain("{");
      });
    }
  }
});
