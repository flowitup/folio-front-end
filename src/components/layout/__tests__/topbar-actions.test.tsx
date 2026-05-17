/**
 * Regression tests for Topbar action wiring.
 *
 * Guards against the "topbar buttons do nothing" bug. The action button
 * label is page-scoped; clicking it must hand off to the correct page via
 * the right query param so the page's existing dialog opens.
 *
 * Also pins:
 * - dashboard has NO topbar action button (overview is read-only)
 * - the dead Search button is gone
 * - the theme button toggles light <-> dark via ThemeContext
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Topbar } from "../Topbar";

// ---- Mocks ----

const mockPush = vi.fn();
let mockPathname = "/en/projects";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/projects",
}));

vi.mock("@/i18n/config", () => ({
  locales: ["en", "fr", "vi"],
  localeNames: { en: "English", fr: "Français", vi: "Tiếng Việt" },
}));

vi.mock("@/components/notifications/notifications-bell", () => ({
  NotificationsBell: () => <div data-testid="bell" />,
}));

const mockSetTheme = vi.fn();
let mockResolvedTheme: "light" | "dark" = "light";
vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: mockResolvedTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

// ---- Helpers ----

function setup(opts: {
  pathname: string;
  selectedProjectId?: string;
}) {
  mockPathname = opts.pathname;
  mockUseAuth.mockReturnValue({
    user: { email: "user@test.com", permissions: [] },
    logout: vi.fn(),
    isLoading: false,
  });
  mockUseProject.mockReturnValue({
    projects: opts.selectedProjectId
      ? [{ id: opts.selectedProjectId, name: "Test" }]
      : [],
    selectedProjectId: opts.selectedProjectId ?? null,
    selectedProject: opts.selectedProjectId
      ? { id: opts.selectedProjectId, name: "Test" }
      : null,
    selectProject: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvedTheme = "light";
});

describe("Topbar action button wiring", () => {
  it("dashboard: action button is NOT rendered (overview is read-only)", () => {
    setup({ pathname: "/en/dashboard" });
    render(<Topbar />);
    // No action button should be visible — only theme + bell + avatar.
    // The theme button is identified by aria-label topbar.theme.
    const actionLabel = screen.queryByText("topbar.newEntry");
    expect(actionLabel).toBeNull();
  });

  it("projects: clicking action navigates to /en/projects?new=1", async () => {
    setup({ pathname: "/en/projects" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /projects.newProject/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects?new=1");
  });

  it("planning: clicking action navigates to /en/projects/:id/planning?new=1", async () => {
    setup({ pathname: "/en/projects/p-1/planning", selectedProjectId: "p-1" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /planning.newTask/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/planning?new=1");
  });

  it("labor: clicking action navigates to /en/projects/:id/labor?logDay=1", async () => {
    setup({ pathname: "/en/projects/p-1/labor", selectedProjectId: "p-1" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /labor.logDay/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/labor?logDay=1");
  });

  it("invoices: clicking action navigates to /en/projects/:id/invoices/new", async () => {
    setup({ pathname: "/en/projects/p-1/invoices", selectedProjectId: "p-1" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /invoices.newInvoice/ }));
    expect(mockPush).toHaveBeenCalledWith("/en/projects/p-1/invoices/new");
  });

  it("planning/labor: clicking action does nothing when no project is selected", async () => {
    setup({ pathname: "/en/projects/p-1/planning" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByRole("button", { name: /planning.newTask/ }));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("Topbar dead-button removal", () => {
  it("Search button is removed entirely", () => {
    setup({ pathname: "/en/dashboard" });
    render(<Topbar />);
    expect(screen.queryByLabelText("topbar.search")).toBeNull();
  });

  it("theme button toggles to dark when current is light", async () => {
    mockResolvedTheme = "light";
    setup({ pathname: "/en/dashboard" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByLabelText("topbar.theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("theme button toggles to light when current is dark", async () => {
    mockResolvedTheme = "dark";
    setup({ pathname: "/en/dashboard" });
    const user = userEvent.setup();
    render(<Topbar />);
    await user.click(screen.getByLabelText("topbar.theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
