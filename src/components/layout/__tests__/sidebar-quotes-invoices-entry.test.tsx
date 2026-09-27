/**
 * The project "Quotes & invoices" nav entry follows the billing gate.
 *
 * Its rows open /billing pages, which are company-admin only (billing
 * layout redirects anyone else), so the desktop sidebar shows the entry only
 * when the layout passes canViewBilling — the same flag that shows the
 * Billing group.
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
  usePathname: () => "/en/projects/p-1/billing",
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

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:read"], companies: [] } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const project = { id: "p-1", name: "Site A", my_permissions: ["project:read"] };
  mockUseProject.mockReturnValue({
    projects: [project],
    selectedProjectId: "p-1",
    selectedProject: project,
    selectProject: vi.fn(),
  });
});

// ---- Tests ----

describe("Sidebar — project quotes & invoices entry", () => {
  it("shows the entry, pointing at the project's billing page, with billing access", () => {
    render(<Sidebar canViewBilling />);
    const link = screen.getByText("navigation.quotesInvoices").closest("a");
    expect(link).toHaveAttribute("href", "/projects/p-1/billing");
    // Active on its own route.
    expect(link?.className).toContain("active");
  });

  it("hides the entry without billing access", () => {
    render(<Sidebar canViewBilling={false} />);
    expect(screen.queryByText("navigation.quotesInvoices")).toBeNull();
    expect(screen.getByText("navigation.invoices")).toBeInTheDocument();
  });

  it("hides the entry when no project is selected", () => {
    mockUseProject.mockReturnValue({
      projects: [],
      selectedProjectId: null,
      selectedProject: null,
      selectProject: vi.fn(),
    });
    render(<Sidebar canViewBilling />);
    expect(screen.queryByText("navigation.quotesInvoices")).toBeNull();
  });
});
