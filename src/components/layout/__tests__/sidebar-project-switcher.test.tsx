/**
 * Tests for the Sidebar active-project switcher pill.
 *
 * Folio projects are named by their site address (e.g.
 * "14 Rue Florentin, 75008 Paris"). The collapsed switcher used to
 * hard-truncate the name to a single line, hiding the complete address.
 * The pill now wraps to two lines and exposes the full value via a
 * title tooltip — these tests pin that behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/projects/p-1/planning",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/folio-logo", () => ({
  FolioLogo: () => <div data-testid="folio-logo" />,
}));

vi.mock("@/components/layout/sidebar-billing-group", () => ({
  SidebarBillingGroup: () => <div data-testid="billing-group" />,
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

// Sidebar reads the caller's permissions/companies to gate "New project" —
// give it a platform-ops user so the pill tests below aren't affected by
// that gate being off.
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["*:*"], companies: [] } }),
}));

const LONG_NAME = "14 Rue Florentin, 75008 Paris, France — Rénovation complète";

function setupWithName(name: string) {
  mockUseProject.mockReturnValue({
    projects: [{ id: "p-1", name }],
    selectedProjectId: "p-1",
    selectedProject: { id: "p-1", name },
    selectProject: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar project switcher — address as the project label", () => {
  it("shows the address instead of the name when the project has one", () => {
    mockUseProject.mockReturnValue({
      projects: [{ id: "p-1", name: "Villa Ngoc", address: "8 rue des Lilas, Arcueil" }],
      selectedProjectId: "p-1",
      selectedProject: { id: "p-1", name: "Villa Ngoc", address: "8 rue des Lilas, Arcueil" },
      selectProject: vi.fn(),
    });
    render(<Sidebar />);
    expect(screen.getByTitle("8 rue des Lilas, Arcueil")).toBeInTheDocument();
    expect(screen.queryByText("Villa Ngoc")).not.toBeInTheDocument();
  });
});

describe("Sidebar project switcher — full name visibility", () => {
  it("exposes the complete project name via the title tooltip", () => {
    setupWithName(LONG_NAME);
    render(<Sidebar />);
    expect(screen.getByTitle(LONG_NAME)).toBeInTheDocument();
  });

  it("clamps the pill label to two lines instead of a single hard-truncated line", () => {
    setupWithName(LONG_NAME);
    render(<Sidebar />);
    expect(screen.getByTitle(LONG_NAME).className).toContain("line-clamp-2");
  });
});
