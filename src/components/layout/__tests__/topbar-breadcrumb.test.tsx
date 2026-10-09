/**
 * The desktop breadcrumb ("<project> › <page>") must keep the page title on
 * one line: a long project address used to squeeze it until "Main-d'œuvre"
 * split at its hyphen. The project name truncates instead.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "../Topbar";

const LONG_NAME = "12 rue du Faubourg Saint-Honoré, 75008 Paris, bâtiment B, escalier 3";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/fr/projects/p-1/labor",
}));

vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/projects/p-1/labor",
}));

vi.mock("@/i18n/config", () => ({
  locales: ["en", "fr", "vi"],
  localeNames: { en: "English", fr: "Français", vi: "Tiếng Việt" },
}));

vi.mock("@/components/notifications/notifications-bell", () => ({
  NotificationsBell: () => <div data-testid="bell" />,
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "user@test.com", permissions: ["project:read"] },
    logout: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/context/ProjectContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/context/ProjectContext")>()),
  useProject: () => ({
    projects: [{ id: "p-1", name: LONG_NAME }],
    selectedProjectId: "p-1",
    selectedProject: { id: "p-1", name: LONG_NAME },
    selectProject: vi.fn(),
  }),
}));

describe("Topbar breadcrumb", () => {
  it("truncates the project name and never wraps the page title", () => {
    render(<Topbar />);
    const crumb = screen
      .getAllByText(LONG_NAME)
      .find((el) => el.parentElement?.className.includes("lg:flex"));
    expect(crumb).toBeDefined();
    expect(crumb!.className).toContain("min-w-0");
    expect(crumb!.className).toContain("truncate");

    const title = crumb!.parentElement!.lastElementChild as HTMLElement;
    expect(title.className).toContain("whitespace-nowrap");
    expect(title.className).toContain("shrink-0");
  });

  it("gives the page title a full-width row of its own below lg", () => {
    // Sharing a row with the five header icons left "Planification" ~93px at 375 ("Planific…").
    const { container } = render(<Topbar />);
    const header = container.querySelector("header")!;
    expect(header.className).toContain("flex-wrap");
    expect(header.className).toContain("lg:flex-nowrap");

    const titleBlock = screen.getByRole("heading", { level: 1 }).parentElement!;
    expect(titleBlock.parentElement).toBe(header);
    expect(titleBlock.className).toContain("order-last");
    expect(titleBlock.className).toContain("basis-full");
    // The project switcher sits on the icons' row, not under the title.
    const switcher = screen
      .getAllByText(LONG_NAME)
      .find((el) => el.closest("button"))!
      .closest("div.lg\\:hidden");
    expect(switcher).not.toBeNull();
    expect(titleBlock.contains(switcher)).toBe(false);
    // ...but wraps to a row of its own rather than squeezing the project name to "789 C…".
    expect(switcher!.className).toContain("min-w-[8rem]");
  });
});
