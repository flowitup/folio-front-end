/**
 * The floating chat button exists only once the backend confirms FEATURE_CHAT, hides on
 * /chat itself, carries the total unread pill and deep-links to the selected project's channel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatFab } from "@/components/chat/chat-fab";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

let mockPathname = "/en/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({
  useChat: () => mockUseChat(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/en/dashboard";
  mockUseProject.mockReturnValue({ selectedProjectId: "p-1" });
});

describe("ChatFab", () => {
  it("renders nothing while the feature is unknown or off", () => {
    mockUseChat.mockReturnValue({ enabled: null, unread: 0 });
    const { unmount } = render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
    unmount();
    mockUseChat.mockReturnValue({ enabled: false, unread: 3 });
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
  });

  it("hides on the chat page itself", () => {
    mockPathname = "/en/chat";
    mockUseChat.mockReturnValue({ enabled: true, unread: 0 });
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
  });

  it("shows the unread pill and opens the selected project's channel", () => {
    mockUseChat.mockReturnValue({ enabled: true, unread: 12 });
    render(<ChatFab />);
    expect(screen.getByTestId("chat-fab-badge")).toHaveTextContent("9+");
    fireEvent.click(screen.getByTestId("chat-fab"));
    expect(mockPush).toHaveBeenCalledWith("/chat?channel=project%3Ap-1");
  });

  it("opens /chat without a channel when no project is selected, no pill at zero", () => {
    mockUseProject.mockReturnValue({ selectedProjectId: null });
    mockUseChat.mockReturnValue({ enabled: true, unread: 0 });
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab-badge")).toBeNull();
    fireEvent.click(screen.getByTestId("chat-fab"));
    expect(mockPush).toHaveBeenCalledWith("/chat");
  });
});
