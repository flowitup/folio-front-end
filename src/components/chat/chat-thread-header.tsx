"use client";

/**
 * Thread header: channel name, member count and stacked member avatars.
 *
 * The admin channel gets its own confidentiality treatment: a lock icon and the
 * "Admin" label next to the name (the backend otherwise gives it the company's plain
 * legal name, indistinguishable from the company channel), plus a confidentiality
 * subtitle instead of the member count — mirrors the phone app's chat header.
 */

import { Lock } from "lucide-react";
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
  const isAdmin = channel?.kind === "admin";
  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-3"
      style={{ borderColor: "var(--line)" }}
      data-testid="chat-thread-header"
    >
      <div className="min-w-0 flex-1">
        <div
          className="flex items-center gap-1.5 truncate text-[15px] font-semibold"
          data-testid="chat-title"
        >
          {isAdmin ? <Lock size={13} aria-hidden="true" data-testid="chat-thread-admin-lock" /> : null}
          <span className="truncate">{channel?.name ?? t("title")}</span>
          {isAdmin ? (
            <span
              className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--paper-2)", color: "var(--ink)" }}
              data-testid="chat-thread-admin-label"
            >
              {t("kind.admin")}
            </span>
          ) : null}
        </div>
        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          {isAdmin
            ? t("adminSubtitle")
            : channel
              ? t("membersCount", { count: channel.member_count })
              : ""}
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
