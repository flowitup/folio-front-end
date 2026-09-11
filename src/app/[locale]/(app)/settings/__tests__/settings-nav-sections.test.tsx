/**
 * Settings nav: which entries the page offers, and to whom.
 *
 * The nav is deliberately short — every entry renders a working surface:
 *  - "Team" and "Billing" were permanent "coming soon" cards (Billing already
 *    owns a top-level nav entry of its own), so both are gone;
 *  - "About" held a single line, the app version, which is now a page footer;
 *  - "Preferences" went when language moved to the top-right control;
 *  - the standalone "Project" mock form went when project edit/delete moved to
 *    the projects list page — the entry that carries the name today is the
 *    project-scoped invoice-prefix section, offered only with a project
 *    selected;
 *  - "Users" is platform-ops only: for anyone else its whole content was a
 *    permission-denied panel.
 *
 * This test pins all of that — and the pruning of the matching i18n keys — so a
 * paste-back cannot quietly resurrect dead UI.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { SettingsClient } from "../settings-client";

// Mutable across tests: permissions decide the Users entry, selectedProject
// decides the Project entry. Hoisted so the vi.mock factories below can close
// over it without hitting the temporal dead zone.
const state = vi.hoisted(() => ({
  permissions: [] as string[],
  selectedProject: null as { id: string; name: string } | null,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "u@example.com",
      display_name: null,
      phone: null,
      permissions: state.permissions,
    },
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/settings",
}));

// ProfileForm (rendered by the default "profile" tab) calls next/navigation's
// useRouter() to refresh after save — stub it since no app router is mounted
// in this test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// profile-actions.ts is a "use server" module — not exercised by this nav
// test, but stub it so importing ProfileForm never touches next/headers.
vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({
  updateProfileAction: vi.fn(),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [],
    selectedProjectId: state.selectedProject?.id ?? null,
    selectedProject: state.selectedProject,
    selectProject: vi.fn(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../users/users-section", () => ({
  UsersSection: () => <div data-testid="users-section" />,
}));

vi.mock("../invoice-prefix-section", () => ({
  InvoicePrefixSection: () => <div data-testid="invoice-prefix-section" />,
}));

vi.mock("@/components/companies/company-settings-section", () => ({
  CompanySettingsSection: () => <div data-testid="company-settings-section" />,
}));

vi.mock("@/components/companies/admin-companies-section", () => ({
  AdminCompaniesSection: () => <div data-testid="admin-companies-section" />,
}));

function renderWith(locale: "en" | "fr" | "vi" = "en") {
  const messages = { en: enMessages, fr: frMessages, vi: viMessages }[locale];
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SettingsClient projects={[]} />
    </NextIntlClientProvider>
  );
}

/** Entry labels in the anchor nav, in order. Scoped to the <nav> landmark
 *  because the content column renders buttons of its own. */
const navNames = () =>
  within(screen.getByRole("navigation"))
    .getAllByRole("button")
    .map((b) => b.textContent?.trim());

const navButton = (name: string) =>
  within(screen.getByRole("navigation")).queryByRole("button", { name });

beforeEach(() => {
  state.permissions = [];
  state.selectedProject = null;
});

describe("Settings nav", () => {
  it("offers only working sections to an ordinary user", () => {
    renderWith();

    expect(navNames()).toEqual([
      "Profile",
      "Company",
      "Payment methods",
      "Notifications",
    ]);
  });

  it("does not offer the retired Team, Billing, About or Preferences entries", () => {
    renderWith();

    for (const name of ["Team", "Billing", "About", "Preferences"]) {
      expect(navButton(name)).toBeNull();
    }
  });

  it("shows the app version as a footer instead of an About tab", () => {
    renderWith();

    expect(screen.getByText(/^Folio v\d+\.\d+\.\d+/)).toBeDefined();
  });

  it("hides Users from a non-platform-ops caller", () => {
    renderWith();

    expect(navButton("Users & Roles")).toBeNull();
  });

  it("offers Users to platform ops", () => {
    state.permissions = ["*:*"];
    renderWith();

    expect(navButton("Users & Roles")).not.toBeNull();
  });

  it("offers Project once a project is selected", () => {
    state.selectedProject = { id: "p1", name: "Maison Lavandou" };
    renderWith();

    expect(navButton("Project")).not.toBeNull();
  });

  it.each([
    ["fr", ["Équipe", "Facturation", "À propos", "Préférences"]],
    ["vi", ["Đội", "Thanh toán", "Giới thiệu", "Tùy chọn"]],
  ] as const)("does not offer the retired entries in %s", (locale, names) => {
    renderWith(locale);

    for (const name of names) {
      expect(navButton(name)).toBeNull();
    }
  });
});
