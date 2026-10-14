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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
const setChatReaction = vi.fn();
const clearChatReaction = vi.fn();
const reportChatMessage = vi.fn();
const blockChatUser = vi.fn();
const unblockChatUser = vi.fn();
const listBlockedChatUsers = vi.fn();
vi.mock("@/lib/api/chat-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat-client")>("@/lib/api/chat-client");
  return {
    ...actual,
    listChatMessages: (...args: unknown[]) => listChatMessages(...args),
    markChatChannelRead: (...args: unknown[]) => markChatChannelRead(...args),
    sendChatMessage: (...args: unknown[]) => sendChatMessage(...args),
    setChatReaction: (...args: unknown[]) => setChatReaction(...args),
    clearChatReaction: (...args: unknown[]) => clearChatReaction(...args),
    reportChatMessage: (...args: unknown[]) => reportChatMessage(...args),
    blockChatUser: (...args: unknown[]) => blockChatUser(...args),
    unblockChatUser: (...args: unknown[]) => unblockChatUser(...args),
    listBlockedChatUsers: (...args: unknown[]) => listBlockedChatUsers(...args),
    fetchChatAttachmentBlob: vi.fn(),
  };
});

import { ChatPanel } from "@/components/chat/chat-panel";
import { REACTION_EMOJIS } from "@/lib/chat/reactions";

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
    channelsError: false,
    unread: 3,
    refreshChannels,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "me", email: "me@example.com", permissions: [] } });
  mockUseProject.mockReturnValue({ selectedProjectId: "p1" });
  listChatMessages.mockResolvedValue({
    items: [
      { id: "m1", channel_key: "project:p1", sender_id: "alice", sender_name: "Alice", body: "Bonjour", attachment: null, created_at: "2026-09-08T08:00:00Z", mine: false },
    ],
    members: [{ id: "alice", name: "Alice", last_read_at: null }],
  });
  markChatChannelRead.mockResolvedValue(undefined);
  listBlockedChatUsers.mockResolvedValue([]);
  reportChatMessage.mockResolvedValue(undefined);
  blockChatUser.mockResolvedValue(undefined);
  unblockChatUser.mockResolvedValue(undefined);
  sendChatMessage.mockResolvedValue({ id: "m2" });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 100 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatPanel", () => {
  it("opens the selected project's channel by default, loads its thread and marks it read", async () => {
    setChat();
    render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(listChatMessages.mock.calls[0][0]).toBe("project:p1");
    expect(markChatChannelRead).toHaveBeenCalledWith("project:p1");
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue");
    expect(screen.getByTestId("chat-channel-project:p1")).toHaveAttribute("aria-selected", "true");
  });

  it("honours a deep-linked channel and switches channels on click", async () => {
    setChat();
    render(<ChatPanel initialChannelKey="company:c1" layout="split" />);
    await waitFor(() => expect(listChatMessages.mock.calls[0][0]).toBe("company:c1"));
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Chung");

    fireEvent.click(screen.getByTestId("chat-channel-project:p1"));
    await waitFor(() => expect(listChatMessages).toHaveBeenLastCalledWith("project:p1", {}, expect.anything()));
    await waitFor(() => expect(markChatChannelRead).toHaveBeenCalledWith("project:p1"));
  });

  it("follows a new requested channel while open and refetches a list that lacks it", async () => {
    setChat();
    const { rerender } = render(<ChatPanel initialChannelKey="company:c1" layout="split" />);
    await waitFor(() => expect(screen.getByTestId("chat-title")).toHaveTextContent("Chung"));

    rerender(<ChatPanel initialChannelKey="project:p1" layout="split" />);
    await waitFor(() => expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue"));

    // A channel newer than the polled list: ask for a fresh list at once.
    refreshChannels.mockClear();
    rerender(<ChatPanel initialChannelKey="project:new" layout="split" />);
    await waitFor(() => expect(refreshChannels).toHaveBeenCalled());
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

    await waitFor(() =>
      expect(sendChatMessage).toHaveBeenCalledWith("project:p1", { body: "On arrive", file: null })
    );
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

  it("keeps the open thread when the polled channel list is re-ordered", async () => {
    setChat();
    const { rerender } = render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue"));
    // Next poll: another channel now sorts first and the project channel is no longer the default.
    mockUseProject.mockReturnValue({ selectedProjectId: null });
    setChat({ channels: [...channels].reverse().concat([{ ...channels[0], key: "company:c9", id: "c9", name: "Autre" }]) });
    rerender(<ChatPanel layout="split" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue");
    expect(markChatChannelRead).toHaveBeenCalledTimes(1);
  });

  it("opens the thread with a back arrow instead of the list in the stacked (compact) layout", async () => {
    setChat();
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(screen.queryByTestId("chat-channel-list")).toBeNull();
    expect(screen.getByTestId("chat-back")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chat-back"));
    expect(screen.getByTestId("chat-list-screen")).toBeInTheDocument();
    expect(screen.getByTestId("chat-channel-list")).toBeInTheDocument();
  });

  it("offers a retry when the channel list cannot be loaded", () => {
    setChat({ channels: [], channelsLoaded: false, channelsError: true, unread: 0 });
    render(<ChatPanel />);
    fireEvent.click(screen.getByText("chat.retry"));
    expect(refreshChannels).toHaveBeenCalled();
    expect(screen.getByTestId("chat-channels-error")).toBeInTheDocument();
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

  describe("reactions", () => {
    const [THUMBS, HEART] = REACTION_EMOJIS;
    const chipTexts = () => screen.queryAllByTestId("chat-reaction-chip").map((c) => c.textContent);

    async function pick(index: number) {
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-message-bubble"));
      });
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("chat-reaction-pick")[index]);
      });
    }

    it("shows the reaction at once, then keeps the server's list for that message", async () => {
      let resolve: (value: unknown) => void = () => {};
      setChatReaction.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());

      await pick(0);
      expect(setChatReaction).toHaveBeenCalledWith("m1", THUMBS);
      expect(chipTexts()).toEqual([`${THUMBS}1`]);
      expect(screen.getByTestId("chat-reaction-chip")).toHaveAttribute("aria-pressed", "true");

      await act(async () => {
        resolve([
          { user_id: "me", emoji: THUMBS, created_at: "2026-09-08T09:00:00Z" },
          { user_id: "alice", emoji: THUMBS, created_at: "2026-09-08T09:01:00Z" },
        ]);
      });
      expect(chipTexts()).toEqual([`${THUMBS}2`]);
    });

    it("removes the viewer's reaction when the same chip is clicked", async () => {
      listChatMessages.mockResolvedValue({
        items: [
          { id: "m1", channel_key: "project:p1", sender_id: "alice", sender_name: "Alice", body: "Bonjour", attachment: null, created_at: "2026-09-08T08:00:00Z", mine: false, reactions: [{ user_id: "me", emoji: HEART, created_at: "2026-09-08T08:05:00Z" }] },
        ],
        members: [{ id: "alice", name: "Alice", last_read_at: null }],
      });
      clearChatReaction.mockResolvedValueOnce([]);
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(chipTexts()).toEqual([`${HEART}1`]));

      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-reaction-chip"));
      });
      expect(clearChatReaction).toHaveBeenCalledWith("m1");
      expect(setChatReaction).not.toHaveBeenCalled();
      expect(chipTexts()).toEqual([]);
    });

    it("toasts and refetches the thread when saving a reaction fails", async () => {
      const { toast } = await import("sonner");
      const { ChatApiError } = await import("@/lib/api/chat-client");
      setChatReaction.mockRejectedValueOnce(new ChatApiError(500, null));
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
      const callsBefore = listChatMessages.mock.calls.length;

      await pick(1);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("chat.errors.reactFailed"));
      await waitFor(() => expect(listChatMessages.mock.calls.length).toBeGreaterThan(callsBefore));
      // The refetched thread (no reactions on the server) replaces the optimistic chip.
      await waitFor(() => expect(chipTexts()).toEqual([]));
    });
  });

  describe("report and block", () => {
    async function openDetails() {
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-message-bubble"));
      });
    }

    it("reports someone else's message after a confirmation", async () => {
      const { toast } = await import("sonner");
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
      await openDetails();
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-report"));
      });
      expect(reportChatMessage).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-moderation-confirm-button"));
      });
      expect(reportChatMessage).toHaveBeenCalledWith("m1");
      expect(toast.success).toHaveBeenCalledWith("chat.moderation.reported");
    });

    it("blocks the sender, then refreshes the thread and the blocked list", async () => {
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
      const messagesBefore = listChatMessages.mock.calls.length;
      listBlockedChatUsers.mockResolvedValue([{ id: "alice", name: "Alice" }]);
      await openDetails();
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-block"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-moderation-confirm-button"));
      });
      expect(blockChatUser).toHaveBeenCalledWith("alice");
      await waitFor(() => expect(listChatMessages.mock.calls.length).toBeGreaterThan(messagesBefore));
      await waitFor(() => expect(screen.getByTestId("chat-blocked-open")).toBeInTheDocument());
    });

    it("lists blocked people and unblocks one", async () => {
      listBlockedChatUsers.mockResolvedValue([{ id: "alice", name: "Alice" }]);
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByTestId("chat-blocked-open")).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-blocked-open"));
      });
      listBlockedChatUsers.mockResolvedValue([]);
      await act(async () => {
        fireEvent.click(screen.getByTestId("chat-unblock-alice"));
      });
      expect(unblockChatUser).toHaveBeenCalledWith("alice");
      await waitFor(() => expect(screen.queryByTestId("chat-blocked-open")).not.toBeInTheDocument());
    });

    it("offers no report or block on the viewer's own messages", async () => {
      listChatMessages.mockResolvedValue({
        items: [
          { id: "m9", channel_key: "project:p1", sender_id: "me", sender_name: "Me", sender_type: "user", body: "Salut", attachment: null, created_at: "2026-09-08T08:00:00Z", mine: true },
        ],
        members: [],
      });
      setChat();
      render(<ChatPanel />);
      await waitFor(() => expect(screen.getByText("Salut")).toBeInTheDocument());
      await openDetails();
      expect(screen.getByTestId("chat-message-details")).toBeInTheDocument();
      expect(screen.queryByTestId("chat-report")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-block")).not.toBeInTheDocument();
    });
  });
});
