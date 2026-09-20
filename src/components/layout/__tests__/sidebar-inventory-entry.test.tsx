/**
 * Sidebar — the inventory entry sits in the company-scoped block, next to the
 * library, for every signed-in role: reads are open to any company member and
 * the server gates writes, so nothing is hidden client-side.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/inventory" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/folio-logo", () => ({ FolioLogo: () => <div data-testid="folio-logo" /> }));
vi.mock("@/components/layout/sidebar-billing-group", () => ({
  SidebarBillingGroup: () => <div data-testid="billing-group" />,
}));
const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({ useProject: () => mockUseProject() }));
const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

function setup(projectPerms: string[], globalPerms: string[] = ["project:read"]) {
  const project = { id: "p-1", name: "Site A", my_permissions: projectPerms };
  mockUseProject.mockReturnValue({
    projects: [project],
    selectedProjectId: "p-1",
    selectedProject: project,
    selectProject: vi.fn(),
  });
  mockUseAuth.mockReturnValue({ user: { permissions: globalPerms, companies: [] } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar — inventory entry", () => {
  it("shows the inventory link to a plain member", () => {
    setup(["project:read"]);
    render(<Sidebar />);
    const link = screen.getByText("navigation.inventory").closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "/inventory");
  });

  it("lists it right after the library, before the project sections", () => {
    setup(["project:read"]);
    render(<Sidebar />);
    const labels = screen
      .getAllByText(/^navigation\./)
      .map((el) => el.textContent)
      .filter((l) => l !== null);
    const library = labels.indexOf("navigation.bibliotheque");
    const inventory = labels.indexOf("navigation.inventory");
    const planning = labels.indexOf("navigation.planning");
    expect(inventory).toBe(library + 1);
    expect(inventory).toBeLessThan(planning);
  });

  it("marks it active on the inventory route", () => {
    setup(["project:read", "project:update"]);
    render(<Sidebar />);
    expect(screen.getByText("navigation.inventory").closest("a")).toHaveClass("active");
  });
});
