/**
 * ChatPanel: picks the selected project's channel by default, polls its thread, marks
 * it read on open, sends a message (JSON path) and refreshes, and renders the
 * disabled / no-channel states.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", email: "me@example.com", permissions: [] } }),
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({
  useChat: () => mockUseChat(),
}));

const listChatMessages = vi.fn();
const markChatChannelRead = vi.fn();
const sendChatMessage = vi.fn();
vi.mock("@/lib/api/chat-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat-client")>("@/lib/api/chat-client");
  return {
    ...actual,
    listChatMessages: (...args: unknown[]) => listChatMessages(...args),
    markChatChannelRead: (...args: unknown[]) => markChatChannelRead(...args),
    sendChatMessage: (...args: unknown[]) => sendChatMessage(...args),
    fetchChatAttachmentBlob: vi.fn(),
  };
});

import { ChatPanel } from "@/components/chat/chat-panel";

const channels = [
  { key: "company:c1", kind: "company", id: "c1", name: "Chung", member_count: 5, unread_count: 3, last_message_at: null },
  { key: "project:p1", kind: "project", id: "p1", name: "Villa Bleue", member_count: 2, unread_count: 0, last_message_at: null },
];

const refreshChannels = vi.fn().mockResolvedValue(undefined);

function setChat(overrides: Partial<ReturnType<typeof mockUseChat>> = {}) {
  mockUseChat.mockReturnValue({
    enabled: true,
    channels,
    channelsLoaded: true,
    unread: 3,
    refreshChannels,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProject.mockReturnValue({ selectedProjectId: "p1" });
  listChatMessages.mockResolvedValue({
    items: [
      { id: "m1", channel_key: "project:p1", sender_id: "alice", sender_name: "Alice", body: "Bonjour", attachment: null, created_at: "2026-09-08T08:00:00Z", mine: false },
    ],
    members: [{ id: "alice", name: "Alice", last_read_at: null }],
  });
  markChatChannelRead.mockResolvedValue(undefined);
  sendChatMessage.mockResolvedValue({ id: "m2" });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 100 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatPanel", () => {
  it("opens the selected project's channel by default, loads its thread and marks it read", async () => {
    setChat();
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(listChatMessages.mock.calls[0][0]).toBe("project:p1");
    expect(markChatChannelRead).toHaveBeenCalledWith("project:p1");
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue");
    expect(screen.getByTestId("chat-channel-project:p1")).toHaveAttribute("aria-selected", "true");
  });

  it("honours a deep-linked channel and switches channels on click", async () => {
    setChat();
    render(<ChatPanel initialChannelKey="company:c1" />);
    await waitFor(() => expect(listChatMessages.mock.calls[0][0]).toBe("company:c1"));
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Chung");

    fireEvent.click(screen.getByTestId("chat-channel-project:p1"));
    await waitFor(() => expect(listChatMessages).toHaveBeenLastCalledWith("project:p1", {}, expect.anything()));
    await waitFor(() => expect(markChatChannelRead).toHaveBeenCalledWith("project:p1"));
  });

  it("sends a text message on Enter, then refreshes the thread and the channel list", async () => {
    setChat();
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    const callsBefore = listChatMessages.mock.calls.length;

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "On arrive" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledWith("project:p1", { body: "On arrive", file: null }));
    await waitFor(() => expect(listChatMessages.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(refreshChannels).toHaveBeenCalled();
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("keeps the draft and toasts when sending fails", async () => {
    const { toast } = await import("sonner");
    const { ChatApiError } = await import("@/lib/api/chat-client");
    sendChatMessage.mockRejectedValueOnce(new ChatApiError(413, null));
    setChat();
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "photo" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("chat-send"));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("chat.errors.tooLarge"));
    expect(input.value).toBe("photo");
  });

  it("shows the disabled notice when the feature is off and the no-channel notice when empty", () => {
    setChat({ enabled: false });
    const { unmount } = render(<ChatPanel />);
    expect(screen.getByTestId("chat-disabled")).toBeInTheDocument();
    expect(listChatMessages).not.toHaveBeenCalled();
    unmount();

    setChat({ channels: [], unread: 0 });
    render(<ChatPanel />);
    expect(screen.getByTestId("chat-no-channels")).toBeInTheDocument();
  });
});
