"use client";

/**
 * Thread body: messages under day dividers, oldest first (the parent scrolls to the end).
 * Incoming = avatar + name + card bubble; mine = positive bubble on the right.
 * `seen` maps a message id to the members whose read marker lands on it (see `seenByMessage`).
 */

import { useTranslations } from "next-intl";
import type { ChatMember, ChatMessage } from "@/lib/api/chat-client";
import {
  dayDividerLabel,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatAttachmentImage } from "@/components/chat/chat-attachment-image";

function SeenBy({ members, mine }: { members: ChatMember[]; mine: boolean }) {
  const t = useTranslations("chat");
  const shown = members.slice(0, 4);
  return (
    <div
      data-testid="chat-seen-by"
      className={`flex items-center px-1 ${mine ? "justify-end" : "justify-start"}`}
      title={t("seenBy", { names: members.map((m) => m.name).join(", ") })}
    >
      {shown.map((member, index) => (
        <ChatAvatar
          key={member.id}
          userId={member.id}
          name={member.name}
          size={14}
          className={index === 0 ? "" : "-ml-1"}
        />
      ))}
      {members.length > shown.length ? (
        <span className="ml-1 text-[10px]" style={{ color: "var(--muted-2)" }}>
          +{members.length - shown.length}
        </span>
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  showSender,
  seenBy,
}: {
  message: ChatMessage;
  showSender: boolean;
  seenBy: ChatMember[] | undefined;
}) {
  const mine = message.mine;
  return (
    <div
      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
      data-testid={mine ? "chat-message-mine" : "chat-message-incoming"}
    >
      {!mine ? (
        <div className="w-7 flex-shrink-0">
          {showSender ? (
            <ChatAvatar userId={message.sender_id} name={message.sender_name} size={28} />
          ) : null}
        </div>
      ) : null}
      <div className={`flex max-w-[76%] flex-col gap-[3px] ${mine ? "items-end" : "items-start"}`}>
        {showSender ? (
          <span className="pl-1 text-[11px]" style={{ color: "var(--muted)" }}>
            {message.sender_name}
          </span>
        ) : null}
        {message.body ? (
          <div
            className="whitespace-pre-wrap break-words px-3 py-[9px] text-[14px] leading-5"
            style={{
              background: mine ? "var(--positive)" : "var(--card)",
              color: mine ? "#fff" : "var(--ink)",
              border: mine ? "none" : "1px solid var(--line)",
              borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            }}
          >
            {message.body}
          </div>
        ) : null}
        {message.attachment ? (
          <ChatAttachmentImage messageId={message.id} attachment={message.attachment} />
        ) : null}
        <span className="px-1 text-[10px]" style={{ color: "var(--muted-2)" }}>
          {timeOf(message.created_at)}
        </span>
        {seenBy && seenBy.length > 0 ? <SeenBy members={seenBy} mine={mine} /> : null}
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  seen,
}: {
  messages: ChatMessage[];
  seen?: Map<string, ChatMember[]>;
}) {
  const t = useTranslations("chat");
  const groups = groupMessagesByDay(messages);
  return (
    <div className="flex flex-col gap-2.5" data-testid="chat-message-list">
      {groups.map((group) => {
        const label = dayDividerLabel(group.dayKey);
        return (
          <div key={group.dayKey} className="flex flex-col gap-2.5">
            <div
              className="mb-1 text-center text-[11px]"
              style={{ color: "var(--muted)" }}
              data-testid="chat-day-divider"
            >
              {"token" in label
                ? `${t(label.token)} · ${group.dayKey.slice(8, 10)}/${group.dayKey.slice(5, 7)}`
                : label.date}
            </div>
            {group.messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                showSender={showsSender(group.messages, index)}
                seenBy={seen?.get(message.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
