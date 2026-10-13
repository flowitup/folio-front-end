"use client";

/**
 * Emoji reactions + read receipts of one chat message.
 *
 * `ChatReactionChips`: counts under the bubble (emoji + count); the viewer's own reaction is
 * highlighted and clicking a chip toggles the viewer's reaction to that emoji.
 * `ChatMessageDetails`: body of the popover opened from a bubble — the six-emoji picker,
 * who reacted with what, and who has read up to the message (with their read time).
 */

import { useTranslations } from "next-intl";
import type { ChatMember, ChatMessage } from "@/lib/api/chat-client";
import { dayKeyOf, timeOf, toLocalDayKey } from "@/lib/chat/group-messages-by-day";
import {
  aggregateReactions,
  isReactionEmoji,
  REACTION_EMOJIS,
  reactionOf,
  type ReactionEmoji,
} from "@/lib/chat/reactions";
import { readersOfMessage } from "@/lib/chat/seen-by";

export type ToggleReaction = (messageId: string, emoji: ReactionEmoji) => void;
/** Asks the panel to confirm reporting a message or blocking its sender. */
export type ModerateMessage = (action: "report" | "block", message: ChatMessage) => void;

/** `HH:mm` today, `dd/mm HH:mm` on an earlier day. */
function readTimeLabel(iso: string): string {
  const dayKey = dayKeyOf(iso);
  if (dayKey === toLocalDayKey(new Date())) return timeOf(iso);
  return `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)} ${timeOf(iso)}`;
}

export function ChatReactionChips({
  message,
  viewerId,
  onToggle,
}: {
  message: ChatMessage;
  viewerId: string | null | undefined;
  onToggle?: ToggleReaction;
}) {
  const t = useTranslations("chat");
  const counts = aggregateReactions(message.reactions ?? [], viewerId);
  if (counts.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap gap-1 px-1 ${message.mine ? "justify-end" : "justify-start"}`}
      data-testid="chat-reaction-chips"
    >
      {counts.map(({ emoji, count, mine }) => {
        const label = t("reactionCount", { emoji, count });
        const chipStyle = {
          background: mine ? "var(--positive-tint)" : "var(--card)",
          borderColor: mine ? "var(--positive)" : "var(--line)",
          color: "var(--ink)",
        };
        const content = (
          <>
            <span aria-hidden="true">{emoji}</span>
            <span className="num" aria-hidden="true">
              {count}
            </span>
          </>
        );
        const className =
          "inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[12px] leading-5";
        // Only the fixed set can be toggled; anything else is shown as a plain count.
        return isReactionEmoji(emoji) && onToggle ? (
          <button
            key={emoji}
            type="button"
            className={`${className} transition-colors hover:brightness-95 focus-visible:outline-2`}
            style={chipStyle}
            aria-label={label}
            aria-pressed={mine}
            data-testid="chat-reaction-chip"
            onClick={() => onToggle(message.id, emoji)}
          >
            {content}
          </button>
        ) : (
          <span
            key={emoji}
            className={className}
            style={chipStyle}
            role="img"
            aria-label={label}
            data-testid="chat-reaction-chip"
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

export function ChatMessageDetails({
  message,
  members,
  viewerId,
  onToggle,
  onModerate,
}: {
  message: ChatMessage;
  members: ChatMember[];
  viewerId: string | null | undefined;
  onToggle?: ToggleReaction;
  /** With it, someone else's message offers Report / Block (App Store guideline 1.2). */
  onModerate?: ModerateMessage;
}) {
  const t = useTranslations("chat");
  const reactions = message.reactions ?? [];
  const current = reactionOf(reactions, viewerId);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? t("unknownMember");
  const readers = readersOfMessage(message, members);
  const canModerate = Boolean(onModerate) && !message.mine && Boolean(message.sender_id);

  return (
    <div className="flex flex-col gap-3 text-[13px]" data-testid="chat-message-details">
      <div className="flex justify-between gap-1" role="group" aria-label={t("reactionsTitle")}>
        {REACTION_EMOJIS.map((emoji) => {
          const selected = current === emoji;
          return (
            <button
              key={emoji}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] transition-colors hover:bg-[var(--paper-2)] focus-visible:outline-2"
              style={selected ? { background: "var(--paper-2)", boxShadow: "inset 0 0 0 1px var(--positive)" } : undefined}
              aria-label={selected ? t("removeReaction", { emoji }) : t("react", { emoji })}
              aria-pressed={selected}
              data-testid="chat-reaction-pick"
              onClick={() => onToggle?.(message.id, emoji)}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          );
        })}
      </div>

      {reactions.length > 0 ? (
        <section aria-labelledby={`reactions-${message.id}`}>
          <h3 id={`reactions-${message.id}`} className="label-cap pb-1">
            {t("reactionsTitle")}
          </h3>
          <ul className="flex flex-col gap-1" data-testid="chat-reactors">
            {reactions.map((reaction) => (
              <li key={reaction.user_id} className="flex items-center justify-between gap-2">
                <span className="truncate" style={{ color: "var(--ink)" }}>
                  {nameOf(reaction.user_id)}
                </span>
                <span>{reaction.emoji}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={`seen-${message.id}`}>
        <h3 id={`seen-${message.id}`} className="label-cap pb-1">
          {t("seenByTitle")}
        </h3>
        {readers.length === 0 ? (
          <p style={{ color: "var(--muted)" }} data-testid="chat-seen-nobody">
            {t("seenByNobody")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="chat-readers">
            {readers.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <span className="truncate" style={{ color: "var(--ink)" }}>
                  {member.name || t("unknownMember")}
                </span>
                <span className="num text-[11px]" style={{ color: "var(--muted)" }}>
                  {member.last_read_at ? readTimeLabel(member.last_read_at) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canModerate ? (
        <section className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            className="rounded px-1 py-1 text-left hover:bg-[var(--paper-2)] focus-visible:outline-2"
            data-testid="chat-report"
            onClick={() => onModerate?.("report", message)}
          >
            {t("moderation.report")}
          </button>
          <button
            type="button"
            className="rounded px-1 py-1 text-left hover:bg-[var(--paper-2)] focus-visible:outline-2"
            style={{ color: "var(--negative, #b42318)" }}
            data-testid="chat-block"
            onClick={() => onModerate?.("block", message)}
          >
            {t("moderation.block", { name: message.sender_name })}
          </button>
        </section>
      ) : null}
    </div>
  );
}
