/**
 * ChatReportsCard: a company admin sees the open reports of the company's conversations and
 * either dismisses one or deletes the message (after a confirmation); either closes every
 * report of that message.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? `(${Object.values(values).join(",")})` : ""}`,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockUseChat = vi.fn();
vi.mock("@/context/ChatContext", () => ({ useChat: () => mockUseChat() }));

const listChatReports = vi.fn();
const resolveChatReport = vi.fn();
vi.mock("@/lib/api/chat-client", () => ({
  listChatReports: (...args: unknown[]) => listChatReports(...args),
  resolveChatReport: (...args: unknown[]) => resolveChatReport(...args),
}));

import { ChatReportsCard } from "@/components/chat/chat-reports-card";

function report(id: string, messageId: string) {
  return {
    id,
    channel_name: "Villa Bleue",
    reporter_id: "u2",
    reporter_name: "Bob",
    reason: id === "r1" ? "insultes" : null,
    created_at: "2026-10-01T09:00:00Z",
    message: {
      id: messageId, channel_key: "project:p1", sender_id: "u3", sender_name: "Deleted account",
      sender_state: "deleted", body: `Corps ${messageId}`, attachment: null,
      created_at: "2026-10-01T08:00:00Z", mine: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseChat.mockReturnValue({ enabled: true });
  resolveChatReport.mockResolvedValue(undefined);
});

describe("ChatReportsCard", () => {
  it("renders nothing without chat", () => {
    mockUseChat.mockReturnValue({ enabled: false });
    render(<ChatReportsCard companyId="c1" />);
    expect(screen.queryByTestId("chat-reports-card")).toBeNull();
    expect(listChatReports).not.toHaveBeenCalled();
  });

  it("shows the empty state", async () => {
    listChatReports.mockResolvedValue([]);
    render(<ChatReportsCard companyId="c1" />);
    expect(await screen.findByTestId("chat-reports-empty")).toBeInTheDocument();
    expect(listChatReports).toHaveBeenCalledWith("c1");
  });

  it("dismisses a report, and deletes a message only after confirming", async () => {
    listChatReports.mockResolvedValue([report("r1", "m1"), report("r2", "m2")]);
    render(<ChatReportsCard companyId="c1" />);
    const first = await screen.findByTestId("chat-report-r1");
    expect(first).toHaveTextContent("Corps m1");
    expect(first).toHaveTextContent("chat.reports.from(chat.deletedAccount)");
    expect(first).toHaveTextContent("chat.reports.reason(insultes)");

    await act(async () => {
      fireEvent.click(first.querySelector("[data-testid=chat-report-dismiss]")!);
    });
    expect(resolveChatReport).toHaveBeenCalledWith("r1", "dismiss");
    await waitFor(() => expect(screen.queryByTestId("chat-report-r1")).toBeNull());

    fireEvent.click(screen.getByTestId("chat-report-delete"));
    expect(resolveChatReport).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(await screen.findByTestId("chat-report-delete-confirm"));
    });
    expect(resolveChatReport).toHaveBeenLastCalledWith("r2", "delete_message");
    await waitFor(() => expect(screen.getByTestId("chat-reports-empty")).toBeInTheDocument());
  });
});
