"use client";

/**
 * Channel picker. Desktop: vertical list (name, kind, unread pill). Mobile widths: a
 * horizontal chip row, the way the phone app draws it.
 */

import { useTranslations } from "next-intl";
import type { ChatChannel } from "@/lib/api/chat-client";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";

interface Props {
  channels: ChatChannel[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function ChatChannelList({ channels, selectedKey, onSelect }: Props) {
  const t = useTranslations("chat");
  return (
    <div
      role="tablist"
      aria-label={t("channels")}
      className="flex flex-col gap-0.5"
      data-testid="chat-channel-list"
    >
      {channels.map((channel) => {
        const active = channel.key === selectedKey;
        const unread = channel.unread_count > 0 && !active;
        return (
          <button
            key={channel.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`chat-channel-${channel.key}`}
            onClick={() => onSelect(channel.key)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--chat-input)]"
            style={{ background: active ? "var(--chat-blue-tint)" : undefined }}
          >
            <ChatAvatar userId={channel.key} name={channel.name} size={44} />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[14px] ${unread ? "font-bold" : "font-medium"}`}
              >
                {channel.name}
              </span>
              <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>
                {t(`kind.${channel.kind}`)} · {t("membersCount", { count: channel.member_count })}
              </span>
            </span>
            {unread ? <ChatUnreadBadge count={channel.unread_count} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function ChatChannelChips({ channels, selectedKey, onSelect }: Props) {
  const t = useTranslations("chat");
  return (
    <div
      role="tablist"
      aria-label={t("channels")}
      className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5"
      data-testid="chat-channel-chips"
    >
      {channels.map((channel) => {
        const active = channel.key === selectedKey;
        return (
          <button
            key={channel.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`chat-chip-${channel.key}`}
            onClick={() => onSelect(channel.key)}
            className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? "var(--chat-blue-tint)" : "var(--chat-input)",
              color: active ? "var(--chat-blue)" : "var(--ink)",
            }}
          >
            <span className="max-w-[160px] truncate">{channel.name}</span>
            {channel.unread_count > 0 && !active ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--chat-blue)" }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
