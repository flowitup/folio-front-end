/**
 * Tests for the top-right LanguageSwitcher control.
 *
 * Pins: the trigger shows the current locale code + an accessible label, the
 * menu lists all locales, and selecting one swaps the locale via the
 * locale-aware router.replace (pathname preserved). Selecting the current
 * locale is a no-op.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "../language-switcher";

const mockReplace = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

let mockSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/projects",
}));

vi.mock("@/i18n/config", () => ({
  locales: ["en", "fr", "vi"],
  localeNames: { en: "English", fr: "Français", vi: "Tiếng Việt" },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch = "";
});

describe("LanguageSwitcher", () => {
  it("renders the current locale code with an accessible label", () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: "common.language" });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain("EN");
  });

  it("switches locale via the locale-aware router.replace, preserving pathname", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "common.language" }));
    await user.click(screen.getByRole("menuitem", { name: /Français/ }));
    expect(mockReplace).toHaveBeenCalledWith("/projects", { locale: "fr" });
  });

  it("keeps the query (open expense, filters) when switching", async () => {
    mockSearch = "invoice=inv-1&tab=labor";
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "common.language" }));
    await user.click(screen.getByRole("menuitem", { name: /Tiếng Việt/ }));
    expect(mockReplace).toHaveBeenCalledWith("/projects?invoice=inv-1&tab=labor", { locale: "vi" });
  });

  it("does nothing when selecting the already-active locale", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "common.language" }));
    await user.click(screen.getByRole("menuitem", { name: /English/ }));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
