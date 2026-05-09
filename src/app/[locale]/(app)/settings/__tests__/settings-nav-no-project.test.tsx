/**
 * Regression: the Settings sidebar no longer exposes a "Project" entry.
 *
 * Project edit/delete now live on the projects list page (PR #40), so the
 * Settings → Project tab (a static mock form) was removed. This test pins
 * the absence of that entry — and the pruning of the i18n key — so a future
 * paste-back doesn't quietly resurrect dead UI.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { SettingsClient } from "../settings-client";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "u@example.com", permissions: [] } }),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/settings",
}));

vi.mock("../users/users-section", () => ({
  UsersSection: () => <div data-testid="users-section" />,
}));

vi.mock("@/components/companies/my-companies-section", () => ({
  MyCompaniesSection: () => <div data-testid="my-companies-section" />,
}));

vi.mock("@/components/companies/admin-companies-section", () => ({
  AdminCompaniesSection: () => <div data-testid="admin-companies-section" />,
}));

function renderWith(locale: "en" | "fr" | "vi") {
  const messages = { en: enMessages, fr: frMessages, vi: viMessages }[locale];
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SettingsClient roles={[]} projects={[]} />
    </NextIntlClientProvider>
  );
}

describe("Settings nav: Project entry removed", () => {
  it("renders the expected sections in en, but not Project", () => {
    renderWith("en");

    // Sanity: known sections still present.
    expect(screen.getByRole("button", { name: "Profile" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Preferences" })).toBeDefined();
    expect(screen.getByRole("button", { name: "About" })).toBeDefined();

    // The standalone "Project" tab is gone.
    expect(screen.queryByRole("button", { name: "Project" })).toBeNull();
  });

  it("does not render Project entry in fr", () => {
    renderWith("fr");
    // "Projet" is the fr translation that was previously used for the tab label.
    expect(screen.queryByRole("button", { name: "Projet" })).toBeNull();
  });

  it("does not render Project entry in vi", () => {
    renderWith("vi");
    // "Dự án" is the vi translation that was previously used for the tab label.
    expect(screen.queryByRole("button", { name: "Dự án" })).toBeNull();
  });

  it("settings.project i18n key is removed from all locales", () => {
    expect(
      (enMessages.settings as Record<string, unknown>).project
    ).toBeUndefined();
    expect(
      (frMessages.settings as Record<string, unknown>).project
    ).toBeUndefined();
    expect(
      (viMessages.settings as Record<string, unknown>).project
    ).toBeUndefined();
  });
});
