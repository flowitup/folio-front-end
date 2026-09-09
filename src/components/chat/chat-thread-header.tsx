"use client";

/** Thread header: channel name, member count and stacked member avatars. */

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
  const shown = members.slice(0, 3);
  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-3"
      style={{ borderColor: "var(--line)" }}
      data-testid="chat-thread-header"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold" data-testid="chat-title">
          {channel?.name ?? t("title")}
        </div>
        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          {channel ? t("membersCount", { count: channel.member_count }) : ""}
        </div>
      </div>
      {shown.length > 0 ? (
        <div className="flex items-center" aria-hidden="true">
          {shown.map((member, index) => (
            <ChatAvatar
              key={member.id}
              userId={member.id}
              name={member.name}
              size={26}
              className={index === 0 ? "" : "-ml-2 ring-2 ring-[var(--paper)]"}
            />
          ))}
          {members.length > shown.length ? (
            <span
              className="num -ml-2 inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ring-2 ring-[var(--paper)]"
              style={{ background: "var(--paper-2)", color: "var(--ink)" }}
            >
              +{members.length - shown.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
