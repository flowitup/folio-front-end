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

describe("ChatMessageList sender without a member id", () => {
  it("renders a message with a null sender_id without crashing and shows its name", () => {
    const assistantMsg = {
      ...msg("a", new Date().toISOString()),
      sender_id: null,
      sender_name: "Legacy sender",
    };
    render(<ChatMessageList messages={[assistantMsg]} />);
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent("Legacy sender");
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent(`body-${assistantMsg.id}`);
  });
});

describe("ChatMessageList job_status messages", () => {
  const jobStatusMsg = (payload: Record<string, unknown>) => ({
    ...msg("a", new Date().toISOString()),
    sender_id: null,
    sender_type: "assistant" as const,
    content_type: "job_status" as const,
    body: "Searching for the invoice…",
    payload,
  });

  it("renders the payload's current text instead of the stale queued body", () => {
    render(
      <ChatMessageList
        messages={[jobStatusMsg({ job_id: "j1", state: "failed", text: "Could not find that invoice." })]}
      />
    );
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent(
      "Could not find that invoice."
    );
    expect(screen.queryByText("Searching for the invoice…")).not.toBeInTheDocument();
  });

  it("falls back to body when the payload has no text field", () => {
    render(<ChatMessageList messages={[jobStatusMsg({ job_id: "j1", state: "running" })]} />);
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent(
      "Searching for the invoice…"
    );
  });
});

describe("ChatMessageList legacy choice messages", () => {
  it("renders an old choice message as plain text with no buttons", () => {
    render(
      <ChatMessageList
        messages={[
          {
            ...msg("a", new Date().toISOString()),
            sender_id: null,
            sender_type: "assistant" as const,
            content_type: "choice" as const,
            body: "Log today for Alice? 1. Yes 2. No",
            payload: { prompt: "Log today for Alice?", options: [{ label: "Yes", action: "x" }] },
          },
        ]}
      />
    );
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent("Log today for Alice? 1. Yes 2. No");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("falls back to the payload prompt when the body is empty", () => {
    render(
      <ChatMessageList
        messages={[
          {
            ...msg("a", new Date().toISOString()),
            sender_id: null,
            content_type: "choice" as const,
            body: null,
            payload: { prompt: "Log today for Alice?" },
          },
        ]}
      />
    );
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent("Log today for Alice?");
  });
});
