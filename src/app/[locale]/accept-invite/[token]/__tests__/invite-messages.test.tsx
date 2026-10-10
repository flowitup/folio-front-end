/**
 * The two invite screens without a project to name must not show raw keys or
 * unfilled ICU placeholders, in any locale.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";

vi.mock("@/lib/auth/actions", () => ({ logout: vi.fn() }));

const state = vi.hoisted(() => ({ messages: {} as Record<string, unknown>, locale: "en" }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (ns: string) =>
    createTranslator({ locale: state.locale, messages: state.messages as never, namespace: ns as never }),
}));

import { LoggedInOther } from "../logged-in-other";
import { InviteError } from "../invite-error";

const LOCALES = [
  ["en", enMessages],
  ["fr", frMessages],
  ["vi", viMessages],
] as const;

describe.each(LOCALES)("invite screens (%s)", (locale, messages) => {
  it("fills the signed-in email into the body", () => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LoggedInOther currentEmail="someone@example.com" returnPath={`/${locale}/accept-invite/tok`} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/someone@example\.com/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("acceptInvite.loggedInOther.body");
  });

  it("gives the error card a heading with no placeholder", async () => {
    state.messages = messages as unknown as Record<string, unknown>;
    state.locale = locale;
    render(await InviteError({ reason: "not_found" as never, locale }));
    expect(screen.getByText(messages.acceptInvite.errors.title)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("{");
  });
});
