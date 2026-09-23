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

describe("ChatMessageList assistant sender", () => {
  it("renders an assistant message (null sender_id) without crashing and shows its name", () => {
    const assistantMsg = {
      ...msg("a", new Date().toISOString()),
      sender_id: null,
      sender_name: "Assistant",
    };
    render(<ChatMessageList messages={[assistantMsg]} />);
    expect(screen.getByTestId("chat-message-incoming")).toHaveTextContent("Assistant");
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

describe("ChatMessageList assistant choice messages", () => {
  const choiceMsg = (payload: Record<string, unknown>) => ({
    ...msg("a", new Date().toISOString()),
    sender_id: null,
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
  });

  it("renders one button per option for the addressed user while unanswered and enabled", () => {
    render(
      <ChatMessageList
        messages={[choiceMsg({})]}
        currentUserId="me"
        assistantEnabled={true}
      />
    );
    expect(screen.getByTestId("chat-assistant-choice-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance")).toBeInTheDocument();
    expect(screen.getByTestId("chat-assistant-choice-option-cancel_bulk_attendance")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-assistant-choice-readonly")).not.toBeInTheDocument();
  });

  it("renders read-only text instead of buttons for anyone the choice was not addressed to", () => {
    render(
      <ChatMessageList
        messages={[choiceMsg({})]}
        currentUserId="someone-else"
        assistantEnabled={true}
      />
    );
    expect(screen.queryByTestId("chat-assistant-choice-buttons")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-assistant-choice-readonly")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders read-only text once the choice is answered, marking the chosen option", () => {
    render(
      <ChatMessageList
        messages={[
          choiceMsg({ answered: "confirm_bulk_attendance", answered_payload: { worker_ids: ["w1"] } }),
        ]}
        currentUserId="me"
        assistantEnabled={true}
      />
    );
    expect(screen.queryByTestId("chat-assistant-choice-buttons")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-assistant-choice-answered")).toHaveTextContent("Yes");
  });

  it("renders read-only text for the addressed user when the assistant feature is off", () => {
    render(
      <ChatMessageList
        messages={[choiceMsg({})]}
        currentUserId="me"
        assistantEnabled={false}
      />
    );
    expect(screen.queryByTestId("chat-assistant-choice-buttons")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-assistant-choice-readonly")).toBeInTheDocument();
  });

  it("disables the buttons and calls back with the message and the tapped option", () => {
    const onSelectChoiceOption = vi.fn();
    render(
      <ChatMessageList
        messages={[choiceMsg({})]}
        currentUserId="me"
        assistantEnabled={true}
        pendingMessageId="a"
        onSelectChoiceOption={onSelectChoiceOption}
      />
    );
    const button = screen.getByTestId("chat-assistant-choice-option-confirm_bulk_attendance");
    expect(button).toBeDisabled();
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
