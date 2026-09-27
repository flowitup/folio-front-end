/**
 * Mobile parity for the project "Quotes & invoices" entry: the "More" sheet
 * applies the client-side twin of hasBillingAccess() — platform ops or admin
 * of at least one company — since the entry's rows open /billing pages.
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

describe("MobileMoreSheet — project quotes & invoices entry", () => {
  it("shows the entry to a company admin", () => {
    setupUser(["project:read"], [{ id: "c-1", role: "admin" }]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    const link = screen.getByText("navigation.quotesInvoices").closest("a");
    expect(link).toHaveAttribute("href", "/projects/p-1/billing");
  });

  it("shows the entry to platform ops", () => {
    setupUser(["*:*"], []);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.getByText("navigation.quotesInvoices")).toBeInTheDocument();
  });

  it("hides the entry from a plain company member", () => {
    setupUser(["project:read"], [{ id: "c-1", role: "member" }]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.queryByText("navigation.quotesInvoices")).toBeNull();
    expect(screen.getByText("navigation.notes")).toBeInTheDocument();
  });
});
