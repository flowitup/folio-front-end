/**
 * Message details popover + reaction chips: a member's bubble opens the picker, who reacted
 * and who has read it; chips count per emoji, highlight the viewer's own and toggle it.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));
vi.mock("@/components/chat/chat-attachment-image", () => ({
  ChatAttachmentImage: () => <div data-testid="chat-attachment" />,
}));
vi.mock("@/components/chat/chat-attachment-audio", () => ({
  ChatAttachmentAudio: () => <div data-testid="chat-attachment-audio" />,
}));

import { ChatMessageList } from "@/components/chat/chat-message-list";
import type { ChatMember, ChatMessage } from "@/lib/api/chat-client";
import { REACTION_EMOJIS } from "@/lib/chat/reactions";

const [THUMBS, HEART, LAUGH] = REACTION_EMOJIS;

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  channel_key: "company:1",
  sender_id: "alice",
  sender_name: "Alice",
  sender_type: "user",
  body: "Bonjour",
  attachment: null,
  created_at: "2026-10-12T08:00:00Z",
  mine: false,
  reactions: [],
  ...overrides,
});

const members: ChatMember[] = [
  { id: "alice", name: "Alice", last_read_at: "2026-10-12T09:00:00Z" },
  { id: "bob", name: "Bob", last_read_at: "2026-10-12T08:30:00Z" },
  { id: "me", name: "Me", last_read_at: "2026-10-12T07:00:00Z" },
];

const reaction = (user_id: string, emoji: string) => ({ user_id, emoji, created_at: "2026-10-12T08:10:00Z" });

function openDetails() {
  act(() => {
    fireEvent.click(screen.getByTestId("chat-message-bubble"));
  });
  return screen.getByTestId("chat-message-details");
}

describe("Chat message details popover", () => {
  it("opens from the bubble with the six-emoji picker and the readers excluding the sender", () => {
    render(<ChatMessageList messages={[message()]} members={members} viewerId="me" />);
    // The bubble opens the details on click; the keyboard reaches them through the "…" button.
    const trigger = screen.getByTestId("chat-message-details-open");
    expect(trigger).toHaveAttribute("aria-label", "chat.messageDetails");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const details = openDetails();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "chat.messageDetails");
    const picks = within(details).getAllByTestId("chat-reaction-pick");
    expect(picks.map((b) => b.textContent)).toEqual([...REACTION_EMOJIS]);
    picks.forEach((b) => expect(b).toHaveAttribute("aria-label", "chat.react"));

    const readers = within(details).getByTestId("chat-readers");
    expect(within(readers).getAllByRole("listitem").map((li) => li.textContent?.replace(/\d.*/, ""))).toEqual([
      "Bob",
    ]);
    // A member's last read time is not when they read THIS message, so no time is shown.
    expect(readers).not.toHaveTextContent(/\d{2}:\d{2}/);
    expect(within(details).queryByTestId("chat-reactors")).toBeNull();
  });

  it("shows the empty state when nobody has read the message yet", () => {
    render(
      <ChatMessageList
        messages={[message()]}
        members={[{ id: "bob", name: "Bob", last_read_at: null }]}
        viewerId="me"
      />
    );
    expect(within(openDetails()).getByTestId("chat-seen-nobody")).toHaveTextContent("chat.seenByNobody");
  });

  it("lists who reacted with which emoji, with a neutral label for a departed member", () => {
    render(
      <ChatMessageList
        messages={[message({ reactions: [reaction("bob", HEART), reaction("ghost", THUMBS)] })]}
        members={members}
        viewerId="me"
      />
    );
    const items = within(within(openDetails()).getByTestId("chat-reactors")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([`Bob${HEART}`, `chat.unknownMember${THUMBS}`]);
  });

  it("marks the viewer's current reaction and closes after a pick, reporting the emoji", () => {
    const onToggleReaction = vi.fn();
    render(
      <ChatMessageList
        messages={[message({ reactions: [reaction("me", LAUGH)] })]}
        members={members}
        viewerId="me"
        onToggleReaction={onToggleReaction}
      />
    );
    const picks = within(openDetails()).getAllByTestId("chat-reaction-pick");
    expect(picks[2]).toHaveAttribute("aria-pressed", "true");
    expect(picks[2]).toHaveAttribute("aria-label", "chat.removeReaction");
    expect(picks[0]).toHaveAttribute("aria-pressed", "false");

    act(() => {
      fireEvent.click(picks[1]);
    });
    expect(onToggleReaction).toHaveBeenCalledWith("m1", HEART);
    expect(screen.queryByTestId("chat-message-details")).toBeNull();
  });

  it("moves focus into the picker on open, closes with Escape and returns focus to its button", async () => {
    render(<ChatMessageList messages={[message()]} members={members} viewerId="me" />);
    const details = openDetails();
    await waitFor(() => expect(within(details).getAllByTestId("chat-reaction-pick")[0]).toHaveFocus());
    act(() => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    });
    expect(screen.queryByTestId("chat-message-details")).toBeNull();
    // Radix restores focus on the next tick after the content unmounts.
    // The bubble is no longer a button (its links must stay clickable): the "…" button is the trigger.
    await waitFor(() => expect(screen.getByTestId("chat-message-details-open")).toHaveFocus());
  });

  it("opens from the time of an attachment-only message", () => {
    render(
      <ChatMessageList
        messages={[
          message({
            body: null,
            attachment: { url: "/x", filename: "site.png", content_type: "image/png", size_bytes: 10 },
          }),
        ]}
        members={members}
        viewerId="me"
      />
    );
    expect(openDetails()).toBeInTheDocument();
  });

  it("does not make assistant or system messages reactable", () => {
    render(
      <ChatMessageList
        messages={[
          message({ id: "a1", sender_type: "assistant", sender_id: null, reactions: [reaction("bob", THUMBS)] }),
          message({ id: "s1", sender_type: "system", sender_id: null }),
        ]}
        members={members}
        viewerId="me"
        onToggleReaction={vi.fn()}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("chat-reaction-chips")).toBeNull();
  });
});

describe("Chat reaction chips", () => {
  it("shows a count per emoji in display order and highlights the viewer's own", () => {
    render(
      <ChatMessageList
        messages={[
          message({
            reactions: [reaction("bob", LAUGH), reaction("me", THUMBS), reaction("alice", LAUGH)],
          }),
        ]}
        members={members}
        viewerId="me"
        onToggleReaction={vi.fn()}
      />
    );
    const chips = screen.getAllByTestId("chat-reaction-chip");
    expect(chips.map((c) => c.textContent)).toEqual([`${THUMBS}1`, `${LAUGH}2`]);
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(chips[1]).toHaveAttribute("aria-pressed", "false");
    expect(chips[1]).toHaveAttribute("aria-label", "chat.reactionCount");
  });

  it("toggles the viewer's reaction to the chip's emoji on click", () => {
    const onToggleReaction = vi.fn();
    render(
      <ChatMessageList
        messages={[message({ reactions: [reaction("bob", HEART)] })]}
        members={members}
        viewerId="me"
        onToggleReaction={onToggleReaction}
      />
    );
    fireEvent.click(screen.getByTestId("chat-reaction-chip"));
    expect(onToggleReaction).toHaveBeenCalledWith("m1", HEART);
    expect(screen.queryByTestId("chat-message-details")).toBeNull();
  });

  it("renders nothing when the message has no reactions", () => {
    render(<ChatMessageList messages={[message()]} members={members} viewerId="me" />);
    expect(screen.queryByTestId("chat-reaction-chips")).toBeNull();
  });
});
