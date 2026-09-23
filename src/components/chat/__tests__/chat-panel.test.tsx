/**
 * ChatPanel: picks the selected project's channel by default, polls its thread, marks
 * it read on open, sends a message (JSON path) and refreshes, and renders the
 * disabled / no-channel states.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
  useLocale: () => "en",
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

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

const mockUseAssistantFeature = vi.fn();
vi.mock("@/hooks/use-chat-feature", () => ({
  useAssistantFeature: () => mockUseAssistantFeature(),
}));

const listChatMessages = vi.fn();
const markChatChannelRead = vi.fn();
const sendChatMessage = vi.fn();
const submitAssistantAction = vi.fn();
vi.mock("@/lib/api/chat-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat-client")>("@/lib/api/chat-client");
  return {
    ...actual,
    listChatMessages: (...args: unknown[]) => listChatMessages(...args),
    markChatChannelRead: (...args: unknown[]) => markChatChannelRead(...args),
    sendChatMessage: (...args: unknown[]) => sendChatMessage(...args),
    submitAssistantAction: (...args: unknown[]) => submitAssistantAction(...args),
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
  mockUseAssistantFeature.mockReturnValue(true);
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
    render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(listChatMessages.mock.calls[0][0]).toBe("project:p1");
    expect(markChatChannelRead).toHaveBeenCalledWith("project:p1");
    expect(screen.getByTestId("chat-title")).toHaveTextContent("Villa Bleue");
    expect(screen.getByTestId("chat-channel-project:p1")).toHaveAttribute("aria-selected", "true");
  });

  it("labels an admin channel with the Admin kind", async () => {
    setChat({
      channels: [
        ...channels,
        { key: "admin:c1", kind: "admin", id: "c1", name: "Chung", member_count: 2, unread_count: 0, last_message_at: null },
      ],
    });
    render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(screen.getByTestId("chat-channel-admin:c1")).toHaveTextContent("chat.kind.admin");
  });

  it("labels the admin channel chip with a lock icon instead of the company's plain name (stacked layout)", async () => {
    setChat({
      channels: [
        ...channels,
        { key: "admin:c1", kind: "admin", id: "c1", name: "Chung", member_count: 2, unread_count: 0, last_message_at: null },
      ],
    });
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    const chip = screen.getByTestId("chat-chip-admin:c1");
    expect(chip).toHaveTextContent("chat.kind.admin");
    expect(chip).not.toHaveTextContent("Chung");
    expect(screen.getByTestId("chat-chip-admin:c1-lock")).toBeInTheDocument();
  });

  it("shows the lock icon, the Admin label and the confidentiality subtitle in the thread header for the admin channel", async () => {
    setChat({
      channels: [
        { key: "admin:c1", kind: "admin", id: "c1", name: "Chung", member_count: 2, unread_count: 0, last_message_at: null },
      ],
    });
    render(<ChatPanel initialChannelKey="admin:c1" />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(screen.getByTestId("chat-thread-admin-lock")).toBeInTheDocument();
    expect(screen.getByTestId("chat-thread-admin-label")).toHaveTextContent("chat.kind.admin");
    expect(screen.getByTestId("chat-thread-header")).toHaveTextContent("chat.adminSubtitle");
    expect(screen.getByTestId("chat-thread-header")).not.toHaveTextContent("chat.membersCount");
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
      expect(sendChatMessage).toHaveBeenCalledWith("project:p1", { body: "On arrive", file: null, lang: "en" })
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

  it("renders channel chips instead of the list in the stacked (compact) layout", async () => {
    setChat();
    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText("Bonjour")).toBeInTheDocument());
    expect(screen.queryByTestId("chat-channel-list")).toBeNull();
    expect(screen.getByTestId("chat-chip-project:p1")).toHaveAttribute("aria-selected", "true");
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
});

describe("ChatPanel assistant choice actions", () => {
  const choiceMessage = (payload: Record<string, unknown> = {}) => ({
    id: "choice-1",
    channel_key: "project:p1",
    sender_id: null,
    sender_name: "Folio",
    sender_type: "assistant" as const,
    content_type: "choice" as const,
    body: "Log today for Alice? 1. Yes 2. No",
    payload: {
      prompt: "Log today for Alice?",
      options: [
        { label: "Yes", action: "confirm_bulk_attendance", payload: { worker_ids: ["w1"] } },
        { label: "No", action: "cancel_bulk_attendance", payload: {} },
      ],
      answered: null,
      addressed_to: "me",
      ...payload,
    },
    attachment: null,
    created_at: "2026-09-08T08:00:00Z",
    mine: false,
  });

  it("sends the exact request body the backend expects for the tapped option", async () => {
    setChat();
    listChatMessages.mockResolvedValue({ items: [choiceMessage()], members: [] });
    submitAssistantAction.mockResolvedValue({ accepted: true });
    render(<ChatPanel layout="split" />);
    await waitFor(() =>
      expect(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance"));
    await waitFor(() =>
      expect(submitAssistantAction).toHaveBeenCalledWith({
        action: "confirm_bulk_attendance",
        payload: { worker_ids: ["w1"] },
        reply_to_id: "choice-1",
      })
    );
  });

  it("disables the option so a second click before the first settles sends only once", async () => {
    setChat();
    listChatMessages.mockResolvedValue({ items: [choiceMessage()], members: [] });
    let resolveAction: ((value: { accepted: boolean }) => void) | undefined;
    submitAssistantAction.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    render(<ChatPanel layout="split" />);
    await waitFor(() =>
      expect(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance")).toBeInTheDocument()
    );
    const button = screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance");
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => {
      resolveAction?.({ accepted: true });
    });
    expect(submitAssistantAction).toHaveBeenCalledTimes(1);
  });

  it("rolls back the optimistic answer, refetches and toasts a retryable message on a 503", async () => {
    const { toast } = await import("sonner");
    const { ChatApiError } = await import("@/lib/api/chat-client");
    setChat();
    listChatMessages.mockResolvedValueOnce({ items: [choiceMessage()], members: [] });
    submitAssistantAction.mockRejectedValueOnce(new ChatApiError(503, { error: "AssistantUnavailable" }));
    // The server resets the choice to unanswered on a 503, so the refetch after the
    // failure sees it still open — the rollback plus refetch should leave it answerable.
    listChatMessages.mockResolvedValueOnce({ items: [choiceMessage()], members: [] });
    render(<ChatPanel layout="split" />);
    await waitFor(() =>
      expect(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("chat.assistant.actionQueueUnavailable"));
    const button = screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("toasts distinct copy for a 403 (not addressed) and a 409 (already answered)", async () => {
    const { toast } = await import("sonner");
    const { ChatApiError } = await import("@/lib/api/chat-client");
    setChat();
    listChatMessages.mockResolvedValue({ items: [choiceMessage()], members: [] });
    submitAssistantAction.mockRejectedValueOnce(new ChatApiError(403, { error: "NotAddressed" }));
    render(<ChatPanel layout="split" />);
    await waitFor(() =>
      expect(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("chat.assistant.actionNotAddressed"));

    submitAssistantAction.mockRejectedValueOnce(new ChatApiError(409, { error: "AlreadyAnswered" }));
    fireEvent.click(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("chat.assistant.actionAlreadyAnswered"));
  });

  it("hides the choice buttons for anyone the choice was not addressed to", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "someone-else", email: "x@example.com", permissions: [] } });
    setChat();
    listChatMessages.mockResolvedValue({ items: [choiceMessage()], members: [] });
    render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByTestId("chat-assistant-choice-readonly")).toBeInTheDocument());
    expect(screen.queryByTestId("chat-assistant-choice-buttons")).not.toBeInTheDocument();
  });

  it("hides the choice buttons when the assistant feature is off", async () => {
    mockUseAssistantFeature.mockReturnValue(false);
    setChat();
    listChatMessages.mockResolvedValue({ items: [choiceMessage()], members: [] });
    render(<ChatPanel layout="split" />);
    await waitFor(() => expect(screen.getByTestId("chat-assistant-choice-readonly")).toBeInTheDocument());
    expect(screen.queryByTestId("chat-assistant-choice-buttons")).not.toBeInTheDocument();
  });
});
