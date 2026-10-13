"use client";

/**
 * Channel picker. Desktop: vertical list (name, kind, unread pill). Mobile widths: a
 * horizontal chip row, the way the phone app draws it.
 */

import { useTranslations } from "next-intl";
import type { ChatChannel } from "@/lib/api/chat-client";
import { cn } from "@/lib/utils";
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
        return (
          <button
            key={channel.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`chat-channel-${channel.key}`}
            onClick={() => onSelect(channel.key)}
            className={cn("nav-link w-full text-left", active && "active")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{channel.name}</span>
              <span
                className="block text-[11px]"
                style={{ color: active ? "var(--paper-2)" : "var(--muted)" }}
              >
                {t(`kind.${channel.kind}`)} · {t("membersCount", { count: channel.member_count })}
              </span>
            </span>
            {!active ? <ChatUnreadBadge count={channel.unread_count} /> : null}
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
            className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium"
            style={{
              background: active ? "var(--ink)" : "var(--card)",
              color: active ? "var(--paper)" : "var(--ink)",
              borderColor: active ? "var(--ink)" : "var(--line)",
            }}
          >
            <span className="max-w-[160px] truncate">{channel.name}</span>
            {channel.unread_count > 0 && !active ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
