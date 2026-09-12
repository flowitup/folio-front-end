/** Day dividers: tokens carry the date suffix; older days print the date once. */

import { render, screen } from "@testing-library/react";
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

const msg = (id: string, created_at: string, mine = false) => ({
  id,
  channel_key: "company:1",
  sender_id: mine ? "me" : "alice",
  sender_name: mine ? "Me" : "Alice",
  body: `body-${id}`,
  attachment: null,
  created_at,
  mine,
});

describe("ChatMessageList day dividers", () => {
  it("prints an older day once as dd/mm and today as token · dd/mm", () => {
    const old = new Date(2020, 0, 5, 10, 0).toISOString();
    const today = new Date();
    const todayKey = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
    render(<ChatMessageList messages={[msg("a", old), msg("b", today.toISOString(), true)]} />);
    const dividers = screen.getAllByTestId("chat-day-divider").map((d) => d.textContent);
    expect(dividers[0]).toBe("05/01");
    expect(dividers[1]).toBe(`chat.today · ${todayKey}`);
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent("Alice");
  });
});

describe("ChatMessageList attachments", () => {
  const withAttachment = (content_type: string) => ({
    ...msg("a", new Date().toISOString()),
    body: null,
    attachment: { url: "/x", filename: "f", content_type, size_bytes: 10 },
  });

  it("plays a voice note instead of rendering it as a picture", () => {
    render(<ChatMessageList messages={[withAttachment("audio/x-m4a")]} />);
    expect(screen.getByTestId("chat-attachment-audio")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-attachment")).not.toBeInTheDocument();
  });

  it("still renders a picture as a picture", () => {
    render(<ChatMessageList messages={[withAttachment("image/jpeg")]} />);
    expect(screen.getByTestId("chat-attachment")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-attachment-audio")).not.toBeInTheDocument();
  });
});
