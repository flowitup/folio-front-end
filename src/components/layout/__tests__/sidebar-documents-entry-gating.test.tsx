/**
 * Documents nav entry is admin/manager-only.
 *
 * The backend requires effective `project:update` on every documents route —
 * listing and downloading included — so a company member must not even see the
 * sidebar link. Managers/admins (project:update in `my_permissions`) keep it.
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

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ---- Helpers ----

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

const MEMBER_PERMS = ["project:read"];
const MANAGER_PERMS = ["project:read", "project:update"];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ----

describe("Sidebar — documents entry gating", () => {
  it("hides the documents link for a member (no project:update)", () => {
    setup(MEMBER_PERMS);
    render(<Sidebar />);
    expect(screen.queryByText("navigation.documents")).toBeNull();
  });

  it("keeps the other project links visible for a member", () => {
    setup(MEMBER_PERMS);
    render(<Sidebar />);
    expect(screen.getByText("navigation.notes")).toBeInTheDocument();
    expect(screen.getByText("navigation.analyses")).toBeInTheDocument();
  });

  it("shows the documents link for a manager (project:update)", () => {
    setup(MANAGER_PERMS);
    render(<Sidebar />);
    expect(screen.getByText("navigation.documents")).toBeInTheDocument();
  });

  it("shows the documents link for platform ops (wildcard permission)", () => {
    setup(MEMBER_PERMS, ["*:*"]);
    render(<Sidebar />);
    expect(screen.getByText("navigation.documents")).toBeInTheDocument();
  });
});
