"use client";

/**
 * Thread body: messages under day dividers, oldest first (the parent scrolls to the end).
 * Messenger look: mine = blue bubble on the right, incoming = grey bubble on the left with the
 * sender's avatar beside the last bubble of a run and their name above the first. Bubbles of one
 * run sit close together with a tight corner on the sender's side; the time shows under the last.
 * `seen` maps a message id to the members whose read marker lands on it (see `seenByMessage`).
 * Clicking a member's message (its text bubble, or its time for a bubble-less attachment), or the
 * small "…" button beside it (the keyboard and screen-reader path), opens a popover with the
 * reaction picker, who reacted, and who has read up to it. The bubble itself is text, not a
 * button: screen readers read the message, and links in it are real links.
 */

import { useState, type MouseEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { isVoiceNote, type ChatMember, type ChatMessage } from "@/lib/api/chat-client";
import { chatPersonName, splitLinks } from "@/lib/chat/person-name";
import {
  dayDividerLabel,
  endsRun,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatAttachmentImage } from "@/components/chat/chat-attachment-image";
import { ChatAttachmentAudio } from "@/components/chat/chat-attachment-audio";
import {
  ChatMessageDetails,
  ChatReactionChips,
  type ModerateMessage,
  type ToggleReaction,
} from "@/components/chat/chat-message-reactions";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A `job_status` message's `body` is fixed at the text from when the job was queued
 * (`update_job_status` only ever updates `payload`, never `body`) — so a web reader stuck
 * on "searching…" forever never learns a fetch failed. `payload.text` always carries
 * the current state text; fall back to `body` for any other content type or a malformed
 * payload.
 */
function displayBody(message: ChatMessage): string | null {
  const text = message.payload?.text;
  if (message.content_type === "job_status" && typeof text === "string") return text;
  if (message.body) return message.body;
  // Legacy `choice` messages carry their question in the payload; show it as plain text.
  const prompt = message.payload?.prompt;
  if (message.content_type === "choice" && typeof prompt === "string") return prompt;
  return message.body;
}

function SeenBy({ members, mine }: { members: ChatMember[]; mine: boolean }) {
  const t = useTranslations("chat");
  const shown = members.slice(0, 4);
  const nameOf = (member: ChatMember) => chatPersonName(member.name, member.state, t);
  return (
    <div
      data-testid="chat-seen-by"
      className={`flex items-center px-1 ${mine ? "justify-end" : "justify-start"}`}
      title={t("seenBy", { names: members.map(nameOf).join(", ") })}
    >
      {shown.map((member, index) => (
        <ChatAvatar
          key={member.id}
          userId={member.id}
          name={nameOf(member)}
          size={16}
          className={index === 0 ? "" : "ml-0.5"}
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

/** Message text with http(s) links made clickable (new tab, no opener). */
function MessageText({ text, mine }: { text: string; mine: boolean }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: mine ? "inherit" : "var(--chat-link)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

/** Only members' messages take reactions; legacy assistant/system ones stay plain. */
function isReactable(message: ChatMessage): boolean {
  return (message.sender_type ?? "user") === "user";
}

interface ReactionProps {
  members: ChatMember[];
  viewerId: string | null | undefined;
  onToggleReaction?: ToggleReaction;
  onModerate?: ModerateMessage;
}

function MessageRow({
  message,
  showSender,
  lastOfRun,
  gapBefore,
  seenBy,
  members,
  viewerId,
  onToggleReaction,
  onModerate,
}: {
  message: ChatMessage;
  showSender: boolean;
  lastOfRun: boolean;
  gapBefore: boolean;
  seenBy: ChatMember[] | undefined;
} & ReactionProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const mine = message.mine;
  const body = displayBody(message);
  const reactable = isReactable(message);
  const senderName = chatPersonName(message.sender_name, message.sender_state, t);

  // min-w-0 + overflow-wrap:anywhere: a long URL or a word without spaces wraps inside the
  // bubble instead of widening it (and the whole thread) past the column.
  const bubbleClass =
    "min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] px-3.5 py-2 text-[14.5px] leading-[1.35]";
  // 18px bubbles; inside a run the corners on the sender's side tighten to 4px.
  const tightTop = !showSender;
  const tightBottom = !lastOfRun;
  const bubbleStyle = {
    // A darker blue than the icons' for text on it: white on #0084ff is only 3.7:1.
    background: mine ? "var(--chat-bubble-mine)" : "var(--chat-bubble)",
    color: mine ? "#fff" : "var(--ink)",
    borderRadius: mine
      ? `18px ${tightTop ? 4 : 18}px ${tightBottom ? 4 : 18}px 18px`
      : `${tightTop ? 4 : 18}px 18px 18px ${tightBottom ? 4 : 18}px`,
  };
  const time = timeOf(message.created_at);
  const timeClass = "px-1 text-[10px]";

  const handleModerate: ModerateMessage = (action, target) => {
    setOpen(false);
    onModerate?.(action, target);
  };

  const handleToggle: ToggleReaction = (messageId, emoji) => {
    setOpen(false);
    onToggleReaction?.(messageId, emoji);
  };

  const openDetails = (event: MouseEvent) => {
    // Selecting text to copy it is not a click on the message.
    if (window.getSelection()?.toString()) return;
    event.stopPropagation();
    setOpen(true);
  };

  const column = (
    <div className={`flex min-w-0 max-w-[76%] flex-col gap-[2px] ${mine ? "items-end" : "items-start"}`}>
      {showSender ? (
        <span className="pl-3 text-[11px]" style={{ color: "var(--muted)" }}>
          {senderName}
        </span>
      ) : null}
      {body ? (
        <div className={`flex max-w-full items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
          <div
            className={`${bubbleClass} ${reactable ? "cursor-pointer" : ""}`}
            style={bubbleStyle}
            onClick={reactable ? openDetails : undefined}
            data-testid={reactable ? "chat-message-bubble" : undefined}
          >
            <MessageText text={body} mine={mine} />
          </div>
          {reactable ? (
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-[var(--paper-2)] focus-visible:opacity-100 focus-visible:outline-2 group-hover/message:opacity-100 data-[state=open]:opacity-100"
                style={{ color: "var(--muted)" }}
                aria-label={t("messageDetails")}
                data-testid="chat-message-details-open"
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </button>
            </PopoverTrigger>
          ) : null}
        </div>
      ) : null}
      {message.attachment ? (
        isVoiceNote(message.attachment.content_type) ? (
          <ChatAttachmentAudio messageId={message.id} attachment={message.attachment} />
        ) : (
          <ChatAttachmentImage messageId={message.id} attachment={message.attachment} />
        )
      ) : null}
      {reactable ? (
        <ChatReactionChips message={message} viewerId={viewerId} onToggle={onToggleReaction} />
      ) : null}
      {reactable && !body ? (
        // An attachment carries its own controls (viewer, player), so its time opens the details.
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${timeClass} cursor-pointer underline-offset-2 hover:underline focus-visible:outline-2`}
            style={{ color: "var(--muted-2)" }}
            aria-label={`${t("messageDetails")} · ${time}`}
            data-testid="chat-message-bubble"
          >
            {time}
          </button>
        </PopoverTrigger>
      ) : lastOfRun ? (
        <span className={timeClass} style={{ color: "var(--muted-2)" }}>
          {time}
        </span>
      ) : null}
      {seenBy && seenBy.length > 0 ? <SeenBy members={seenBy} mine={mine} /> : null}
    </div>
  );

  return (
    <div
      className={`group/message flex items-end gap-2 ${gapBefore ? "mt-2" : ""} ${mine ? "justify-end" : "justify-start"}`}
      data-testid={mine ? "chat-message-mine" : "chat-message-incoming"}
    >
      {!mine ? (
        <div className="w-7 flex-shrink-0">
          {lastOfRun ? (
            <ChatAvatar userId={message.sender_id} name={senderName} size={28} />
          ) : null}
        </div>
      ) : null}
      {reactable ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>{column}</PopoverAnchor>
          <PopoverContent
            align={mine ? "end" : "start"}
            className="z-[80] w-72 p-3"
            aria-label={t("messageDetails")}
          >
            <ChatMessageDetails
              message={message}
              members={members}
              viewerId={viewerId}
              onToggle={handleToggle}
              onModerate={onModerate ? handleModerate : undefined}
            />
          </PopoverContent>
        </Popover>
      ) : (
        column
      )}
    </div>
  );
}

export function ChatMessageList({
  messages,
  seen,
  members = [],
  viewerId,
  onToggleReaction,
  onModerate,
}: {
  messages: ChatMessage[];
  seen?: Map<string, ChatMember[]>;
  /** Channel members: names for reactions and read times for "seen by". */
  members?: ChatMember[];
  /** Current user id (highlights their own reaction). */
  viewerId?: string | null;
  onToggleReaction?: ToggleReaction;
  /** Report / Block entries in the message details of other people's messages. */
  onModerate?: ModerateMessage;
}) {
  const t = useTranslations("chat");
  const groups = groupMessagesByDay(messages);
  return (
    <div className="flex flex-col gap-2" data-testid="chat-message-list">
      {groups.map((group) => {
        const label = dayDividerLabel(group.dayKey);
        return (
          <div key={group.dayKey} className="flex flex-col gap-[3px]">
            <div
              className="my-2 text-center text-[11px] font-medium"
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
                lastOfRun={endsRun(group.messages, index)}
                gapBefore={index > 0 && endsRun(group.messages, index - 1)}
                seenBy={seen?.get(message.id)}
                members={members}
                viewerId={viewerId}
                onToggleReaction={onToggleReaction}
                onModerate={onModerate}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
