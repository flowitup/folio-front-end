"use client";

/**
 * Thread body: messages under day dividers, oldest first (the parent scrolls to the end).
 * Incoming = avatar + name + card bubble; mine = positive bubble on the right.
 * `seen` maps a message id to the members whose read marker lands on it (see `seenByMessage`).
 */

import { useTranslations } from "next-intl";
import { isVoiceNote, type ChatMember, type ChatMessage } from "@/lib/api/chat-client";
import {
  dayDividerLabel,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";
import { highlightMention } from "@/lib/chat/highlight-mention";
import { parseChoicePayload, type AssistantChoiceOption } from "@/lib/chat/assistant-choice";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatAttachmentImage } from "@/components/chat/chat-attachment-image";
import { ChatAttachmentAudio } from "@/components/chat/chat-attachment-audio";
import { ChatAssistantChoice } from "@/components/chat/chat-assistant-choice";

/**
 * A `job_status` message's `body` is fixed at the text from when the job was queued
 * (`update_job_status` only ever updates `payload`, never `body`) — so a web reader stuck
 * on "searching…" forever never learns a fetch failed. `payload.text` always carries
 * the current state text; fall back to `body` for any other content type or a malformed
 * payload.
 */
function displayBody(message: ChatMessage): string | null {
  if (message.content_type === "job_status") {
    const text = message.payload?.text;
    if (typeof text === "string") return text;
  }
  return message.body;
}

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
  currentUserId,
  assistantEnabled,
  pendingMessageId,
  onSelectChoiceOption,
}: {
  message: ChatMessage;
  showSender: boolean;
  seenBy: ChatMember[] | undefined;
  /** Current signed-in user, to tell an addressed choice apart from everyone else's. */
  currentUserId?: string | null;
  /** Off (or still unknown): choice options render as read-only text instead of buttons,
   * since the backend would 404 `FeatureDisabled` on a tap. */
  assistantEnabled?: boolean;
  /** Id of the choice message currently being answered, if any — its buttons stay
   * disabled until the request settles (no double submit). */
  pendingMessageId?: string | null;
  onSelectChoiceOption?: (message: ChatMessage, option: AssistantChoiceOption) => void;
}) {
  const mine = message.mine;
  const body = displayBody(message);
  const choicePayload =
    message.sender_type === "assistant" && message.content_type === "choice"
      ? parseChoicePayload(message.payload)
      : null;
  const canAnswerChoice =
    choicePayload !== null &&
    assistantEnabled === true &&
    choicePayload.answered === null &&
    choicePayload.addressedTo !== null &&
    currentUserId != null &&
    choicePayload.addressedTo === currentUserId;
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
        {choicePayload ? (
          <ChatAssistantChoice
            prompt={choicePayload.prompt}
            options={choicePayload.options}
            answered={choicePayload.answered}
            answeredPayload={choicePayload.answeredPayload}
            canAnswer={canAnswerChoice}
            pending={pendingMessageId === message.id}
            onSelect={(option) => onSelectChoiceOption?.(message, option)}
          />
        ) : body ? (
          <div
            className="whitespace-pre-wrap break-words px-3 py-[9px] text-[14px] leading-5"
            style={{
              background: mine ? "var(--positive)" : "var(--card)",
              color: mine ? "#fff" : "var(--ink)",
              border: mine ? "none" : "1px solid var(--line)",
              borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            }}
          >
            {message.sender_type === "assistant" ? body : highlightMention(body)}
          </div>
        ) : null}
        {message.attachment ? (
          isVoiceNote(message.attachment.content_type) ? (
            <ChatAttachmentAudio messageId={message.id} attachment={message.attachment} />
          ) : (
            <ChatAttachmentImage messageId={message.id} attachment={message.attachment} />
          )
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
  currentUserId,
  assistantEnabled,
  pendingMessageId,
  onSelectChoiceOption,
}: {
  messages: ChatMessage[];
  seen?: Map<string, ChatMember[]>;
  /** Current signed-in user, to tell an addressed choice apart from everyone else's. */
  currentUserId?: string | null;
  /** Off (or still unknown): choice options render as read-only text instead of buttons. */
  assistantEnabled?: boolean;
  /** Id of the choice message currently being answered, if any. */
  pendingMessageId?: string | null;
  onSelectChoiceOption?: (message: ChatMessage, option: AssistantChoiceOption) => void;
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
                currentUserId={currentUserId}
                assistantEnabled={assistantEnabled}
                pendingMessageId={pendingMessageId}
                onSelectChoiceOption={onSelectChoiceOption}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
