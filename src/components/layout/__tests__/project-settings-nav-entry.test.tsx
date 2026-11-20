/**
 * "Project settings" sits at the end of the project nav (desktop sidebar and
 * phone "More" sheet) for those who may edit the project — the credit and
 * invoice prefix are one click away from any page. Members never see it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { MobileMoreSheet } from "../mobile-more-sheet";

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

const settingsLink = () => screen.queryByText("topbar.projectSettingsTitle")?.closest("a") ?? null;

describe("Project settings nav entry", () => {
  it("links the editor to the project's settings, last of the project nav, on the sidebar", () => {
    setup(MANAGER_PERMS);
    render(<Sidebar />);
    const link = settingsLink();
    expect(link).toHaveAttribute("href", "/projects/p-1/settings");
    // After the last project section, before the global settings.
    const photos = screen.getByText("navigation.photos").closest("a")!;
    expect(photos.compareDocumentPosition(link!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("navigation.settings")).toBeInTheDocument();
  });

  it("hides it from a member on the sidebar", () => {
    setup(MEMBER_PERMS);
    render(<Sidebar />);
    expect(settingsLink()).toBeNull();
  });

  it("shows it to an editor and hides it from a member in the More sheet", () => {
    setup(MANAGER_PERMS);
    const { unmount } = render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(settingsLink()).toHaveAttribute("href", "/projects/p-1/settings");
    unmount();

    setup(MEMBER_PERMS);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(settingsLink()).toBeNull();
  });
});
