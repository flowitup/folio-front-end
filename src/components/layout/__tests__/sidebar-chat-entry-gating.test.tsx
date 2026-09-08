/**
 * The Chat sidebar entry exists only once the backend confirms FEATURE_CHAT
 * (`GET /features` → chat:true) and carries the total unread pill.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/chat",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, prefetch: _prefetch, ...rest }: { children: React.ReactNode; prefetch?: boolean }) => (
    <a {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/folio-logo", () => ({
  FolioLogo: () => <div data-testid="folio-logo" />,
}));

vi.mock("@/components/layout/sidebar-billing-group", () => ({
  SidebarBillingGroup: () => <div data-testid="billing-group" />,
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [],
    selectedProjectId: null,
    selectedProject: null,
    selectProject: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:read"], companies: [] } }),
}));

const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({
  useChat: () => mockUseChat(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar — chat entry gating", () => {
  it("hides the chat link while the feature is unknown or off", () => {
    mockUseChat.mockReturnValue({ enabled: null, channels: [], unread: 0 });
    const { unmount } = render(<Sidebar />);
    expect(screen.queryByTestId("chat-nav-link")).toBeNull();
    unmount();

    mockUseChat.mockReturnValue({ enabled: false, channels: [], unread: 0 });
    render(<Sidebar />);
    expect(screen.queryByTestId("chat-nav-link")).toBeNull();
  });

  it("shows the chat link, active on /chat, with the unread pill when enabled", () => {
    mockUseChat.mockReturnValue({ enabled: true, channels: [], unread: 12 });
    render(<Sidebar />);
    const link = screen.getByTestId("chat-nav-link");
    expect(link).toHaveAttribute("href", "/chat");
    expect(link.className).toContain("active");
    expect(screen.getByText("navigation.chat")).toBeInTheDocument();
    expect(screen.getByTestId("chat-unread-badge")).toHaveTextContent("9+");
  });

  it("renders no pill at zero unread", () => {
    mockUseChat.mockReturnValue({ enabled: true, channels: [], unread: 0 });
    render(<Sidebar />);
    expect(screen.getByTestId("chat-nav-link")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-unread-badge")).toBeNull();
  });
});
