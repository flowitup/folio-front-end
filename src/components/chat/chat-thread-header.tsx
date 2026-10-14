"use client";

/** Thread header (Messenger style): channel avatar, bold name, member count and first names. */

import { useTranslations } from "next-intl";
import type { ChatChannel, ChatMember } from "@/lib/api/chat-client";
import { ChatAvatar } from "@/components/chat/chat-avatar";

export function ChatThreadHeader({
  channel,
  members,
}: {
  channel: ChatChannel | null;
  members: ChatMember[];
}) {
  const t = useTranslations("chat");
  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-2.5"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
      data-testid="chat-thread-header"
    >
      {channel ? <ChatAvatar userId={channel.key} name={channel.name} size={40} /> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15.5px] font-bold" data-testid="chat-title">
          {channel?.name ?? t("title")}
        </div>
        <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
          {channel
            ? `${t("membersCount", { count: channel.member_count })}${
                members.length > 0
                  ? " · " +
                    members
                      .slice(0, 3)
                      .map((m) => m.name)
                      .join(", ") +
                    (members.length > 3 ? "…" : "")
                  : ""
              }`
            : ""}
        </div>
      </div>
    </div>
  );
}
