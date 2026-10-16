/**
 * The sidebar follows the selected project's company: its hidden sections
 * (Settings › Company › Hidden sections) and its admin gate for the project's
 * quotes & invoices. Company-wide areas disappear only when every company of
 * the user hides them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/dashboard" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/folio-logo", () => ({ FolioLogo: () => <div /> }));
vi.mock("@/components/layout/sidebar-billing-group", () => ({
  SidebarBillingGroup: () => <div data-testid="billing-group" />,
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({ useProject: () => mockUseProject() }));

const companies = [
  { id: "co-a", legal_name: "A", role: "admin", is_primary: true, hidden_sections: ["notes", "library"] },
  { id: "co-b", legal_name: "B", role: "member", is_primary: false, hidden_sections: ["photos", "library"] },
];
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:read"], companies } }),
}));

function selectProject(companyId: string) {
  const project = { id: "p-1", name: "Site", company_id: companyId, my_permissions: ["project:read"] };
  mockUseProject.mockReturnValue({
    projects: [project],
    selectedProjectId: "p-1",
    selectedProject: project,
    selectProject: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("Sidebar — company hidden sections", () => {
  it("hides the sections of the selected project's company, not the primary one", () => {
    selectProject("co-b");
    render(<Sidebar canViewBilling />);
    expect(screen.queryByText("navigation.photos")).toBeNull();
    expect(screen.getByText("navigation.notes")).toBeInTheDocument();
  });

  it("hides a company-wide area only when every company hides it", () => {
    selectProject("co-a");
    render(<Sidebar canViewBilling />);
    expect(screen.queryByText("navigation.notes")).toBeNull();
    expect(screen.queryByText("navigation.bibliotheque")).toBeNull();
    expect(screen.getByText("navigation.inventory")).toBeInTheDocument();
    expect(screen.getByTestId("billing-group")).toBeInTheDocument();
  });

  it("shows the project's quotes & invoices only to admins of the project's company", () => {
    selectProject("co-b");
    render(<Sidebar canViewBilling />);
    expect(screen.queryByText("navigation.quotesInvoices")).toBeNull();
  });

  it("shows them on a project of a company the user administers", () => {
    selectProject("co-a");
    render(<Sidebar canViewBilling />);
    expect(screen.getByText("navigation.quotesInvoices")).toBeInTheDocument();
  });
});

describe("Sidebar — project switcher company", () => {
  it("names the selected project's company when the user has several", () => {
    selectProject("co-b");
    render(<Sidebar />);
    expect(screen.getByTestId("project-switcher-selected-company")).toHaveTextContent("B");
  });
});
