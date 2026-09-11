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
 * This test pins all of that, the hash fallbacks, and the removal of the
 * matching i18n keys, so a paste-back cannot quietly resurrect dead UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

/** The nav entry currently styled as selected. */
const activeNavName = () =>
  within(screen.getByRole("navigation"))
    .getAllByRole("button")
    .find((b) => b.className.includes("bg-[var(--ink)]"))
    ?.textContent?.trim();

/** Keys that existed only to label an entry the nav no longer offers. */
const RETIRED_KEYS = ["team", "billing", "about", "version", "comingSoon"];

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
    ["fr", ["Profil", "Entreprise", "Moyens de paiement", "Notifications"],
      ["Équipe", "Facturation", "À propos", "Préférences"]],
    ["vi", ["Hồ sơ", "Công ty", "Phương thức thanh toán", "Thông báo"],
      ["Đội", "Thanh toán", "Giới thiệu", "Tùy chọn"]],
  ] as const)(
    "offers exactly the working sections in %s, and none of the retired ones",
    (locale, expected, retired) => {
      renderWith(locale);

      // Asserting the exact list, not just the absence of the retired labels:
      // next-intl renders the key path rather than throwing on a missing
      // message, so an fr/vi deletion would otherwise slip through green.
      expect(navNames()).toEqual([...expected]);
      for (const name of retired) {
        expect(navButton(name)).toBeNull();
      }
    }
  );

  // ---------------------------------------------------------------------
  // Hash handling
  // ---------------------------------------------------------------------

  describe("deep links", () => {
    /** The tab is chosen once, from the hash present at mount. */
    function renderAtHash(hash: string) {
      window.location.hash = hash;
      return renderWith();
    }

    afterEach(() => {
      window.location.hash = "";
    });

    it.each(["#team", "#billing", "#about", "#nonsense"])(
      "sends the retired hash %s to Profile",
      (hash) => {
        renderAtHash(hash);
        expect(activeNavName()).toBe("Profile");
      }
    );

    it("keeps #my-companies landing on the merged Company section", () => {
      renderAtHash("#my-companies");
      expect(activeNavName()).toBe("Company");
    });

    it("sends #users to Profile for a non-platform-ops caller", () => {
      renderAtHash("#users");
      expect(activeNavName()).toBe("Profile");
    });

    it("opens #users for platform ops", () => {
      state.permissions = ["*:*"];
      renderAtHash("#users");
      expect(activeNavName()).toBe("Users & Roles");
    });

    it("falls back to Profile for #project with no project selected", () => {
      renderAtHash("#project");
      expect(activeNavName()).toBe("Profile");
      expect(screen.queryByTestId("invoice-prefix-section")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // i18n keys behind the retired entries
  // ---------------------------------------------------------------------

  it.each(["en", "fr", "vi"] as const)(
    "has no message left for a retired entry in %s",
    (locale) => {
      const settings = ({ en: enMessages, fr: frMessages, vi: viMessages }[
        locale
      ] as { settings: Record<string, unknown> }).settings;

      for (const key of RETIRED_KEYS) {
        expect(settings[key]).toBeUndefined();
      }
    }
  );
});
