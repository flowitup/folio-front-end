/**
 * The floating chat button exists only once the backend confirms FEATURE_CHAT, hides while
 * the drawer is open, carries the total unread pill and opens the selected project's channel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatFab } from "@/components/chat/chat-fab";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

const mockOpenChat = vi.fn();

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({
  useChat: () => mockUseChat(),
}));

function chat(overrides: Record<string, unknown>) {
  return { isOpen: false, openChat: mockOpenChat, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProject.mockReturnValue({ selectedProjectId: "p-1" });
});

describe("ChatFab", () => {
  it("renders nothing while the feature is unknown or off", () => {
    mockUseChat.mockReturnValue(chat({ enabled: null, unread: 0 }));
    const { unmount } = render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
    unmount();
    mockUseChat.mockReturnValue(chat({ enabled: false, unread: 3 }));
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
  });

  it("hides while the drawer is open", () => {
    mockUseChat.mockReturnValue(chat({ enabled: true, unread: 0, isOpen: true }));
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab")).toBeNull();
  });

  it("shows the unread pill and opens the selected project's channel", () => {
    mockUseChat.mockReturnValue(chat({ enabled: true, unread: 12 }));
    render(<ChatFab />);
    expect(screen.getByTestId("chat-fab-badge")).toHaveTextContent("9+");
    fireEvent.click(screen.getByTestId("chat-fab"));
    expect(mockOpenChat).toHaveBeenCalledWith("project:p-1");
  });

  it("opens the default channel when no project is selected, no pill at zero", () => {
    mockUseProject.mockReturnValue({ selectedProjectId: null });
    mockUseChat.mockReturnValue(chat({ enabled: true, unread: 0 }));
    render(<ChatFab />);
    expect(screen.queryByTestId("chat-fab-badge")).toBeNull();
    fireEvent.click(screen.getByTestId("chat-fab"));
    expect(mockOpenChat).toHaveBeenCalledWith(null);
  });
});
