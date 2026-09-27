/**
 * The mobile "More" sheet offers what the desktop sidebar offers: the
 * company pages (library, inventory), the project's cost planning and media,
 * and the billing group — the latter only to company admins, like the
 * sidebar, since everyone else is redirected away from /billing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileMoreSheet } from "../mobile-more-sheet";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/projects/p-1/notes",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [{ id: "p-1", name: "Site A", my_permissions: ["project:read"] }],
    selectedProjectId: "p-1",
    selectedProject: { id: "p-1", name: "Site A", my_permissions: ["project:read"] },
    selectProject: vi.fn(),
  }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function setupUser(permissions: string[], companies: { id: string; role: string }[]) {
  mockUseAuth.mockReturnValue({ user: { permissions, companies } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ----

describe("MobileMoreSheet — parity with the desktop sidebar", () => {
  it("links the company pages and the project's cost planning and media", () => {
    setupUser(["project:read"], [{ id: "c-1", role: "member" }]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    const href = (key: string) => screen.getByText(`navigation.${key}`).closest("a")?.getAttribute("href");
    expect(href("bibliotheque")).toBe("/bibliotheque");
    expect(href("inventory")).toBe("/inventory");
    expect(href("chiffrage")).toBe("/projects/p-1/chiffrage");
    expect(href("photos")).toBe("/projects/p-1/photos");
  });

  it("shows the billing group, refundable included, to a company admin", () => {
    setupUser(["project:read"], [{ id: "c-1", role: "admin" }]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.getByText("sidebar.billing.title")).toBeInTheDocument();
    expect(screen.getByText("sidebar.billing.refundableInvoices").closest("a")).toHaveAttribute(
      "href",
      "/billing/refundable-invoices"
    );
  });

  it("hides the billing group from managers and members", () => {
    setupUser(["project:read"], [{ id: "c-1", role: "manager" }]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.queryByText("sidebar.billing.title")).toBeNull();
    expect(screen.queryByText("sidebar.billing.devis")).toBeNull();
  });
});
